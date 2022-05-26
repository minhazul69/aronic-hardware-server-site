const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ylkif.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
// VERIFY USER ON JOTtOKEN
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorize Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}
async function run() {
  await client.connect();
  const productCollection = client.db("aronic-hardware").collection("products");
  const userCollection = client.db("aronic-hardware").collection("user");
  const orderCollection = client.db("aronic-hardware").collection("order");
  const reviewCollection = client.db("aronic-hardware").collection("review");
  const paymentCollection = client.db("aronic-hardware").collection("payment");
  const userProfileCollection = client
    .db("aronic-hardware")
    .collection("userProfile");
  // VERIFY ADMIN
  const verifyAdmin = async (req, res, next) => {
    const requester = req.decoded.email;
    const requesterAccount = await userCollection.findOne({
      email: requester,
    });
    if (requesterAccount.role === "admin") {
      next();
    } else {
      res.status(403).send({ message: "Forbidden Access" });
    }
  };
  //   FIND ALL PRODUCT
  app.get("/products", async (req, res) => {
    const result = await productCollection.find().toArray();
    res.send(result);
  });
  //   FIND PRODUCT ON ID
  app.get("/product/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await productCollection.findOne(query);
    res.send(result);
  });
  // INSERT PRODUCT
  app.post("/product", async (req, res) => {
    const product = req.body;
    const result = await productCollection.insertOne(product);
    res.send(result);
  });
  // DELETE PRODUCT
  app.delete("/product/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await productCollection.deleteOne(query);
    res.send(result);
  });
  //   PRODUCT QUANTITY UPDATE
  app.put("/product/:id", async (req, res) => {
    const id = req.params.id;
    const updateUser = req.body;
    const filter = { _id: ObjectId(id) };
    const options = { upsert: true };
    const updateDoc = {
      $set: {
        newQuantity: updateUser.quantity,
      },
      $set: updateUser,
    };
    const result = await productCollection.updateOne(
      filter,
      updateDoc,
      options
    );
    res.send(result);
  });

  //   ALL ORDER
  // GET ALL ORDER
  app.get("/orders", verifyJWT, async (req, res) => {
    const result = await orderCollection.find().toArray();
    res.send(result);
  });
  //   GET MY  ORDER
  app.get("/order", verifyJWT, async (req, res) => {
    const email = req.query?.email;
    const decodedEmail = req.decoded.email;
    if (email === decodedEmail) {
      const query = { email: email };
      const order = await orderCollection.find(query).toArray();
      return res.send(order);
    } else {
      return res.status(403).send({ message: "Forbidden Access" });
    }
  });
  // CREATE PAYMENT INTENT
  app.post("/create-payment-intent", verifyJWT, async (req, res) => {
    const service = req.body;
    const price = service.price;
    const amount = price * 100;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      payment_method_types: ["card"],
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  });
  // MY ORDER UPDATE
  app.patch("/order/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const payment = req.body;
    const filter = { _id: ObjectId(id) };
    const pending = "pending";
    const updateDoc = {
      $set: {
        status: pending,
        transactionId: payment.transactionId,
      },
    };
    const result = await paymentCollection.insertOne(payment);
    const updateBooking = await orderCollection.updateOne(filter, updateDoc);
    res.send(updateBooking);
  });
  // ORDER STATUS UPDATE
  app.patch("/updateOrder/:id", verifyJWT, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const filter = { _id: ObjectId(id) };
    const shipped = "shipped";
    const updateDoc = {
      $set: {
        status: shipped,
      },
    };
    const updateBooking = await orderCollection.updateOne(filter, updateDoc);
    res.send(updateBooking);
  });
  // GET SPACIAL ORDER
  app.get("/order/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const order = await orderCollection.findOne(query);
    res.send(order);
  });
  //   DELETE MY ORDER
  app.delete("/order/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await orderCollection.deleteOne(query);
    res.send(result);
  });
  // GET ALL REVIEW
  app.get("/review", async (req, res) => {
    const result = await reviewCollection.find().toArray();
    res.send(result);
  });
  //   USER REVIEW ADDED
  app.post("/review", async (req, res) => {
    const product = req.body;
    const result = await reviewCollection.insertOne(product);
    res.send(result);
  });
  //   FIND ALL USER
  app.get("/user", verifyJWT, async (req, res) => {
    const result = await userCollection.find().toArray();
    res.send(result);
  });
  // DELETE USER
  app.delete("/user/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await userCollection.deleteOne(query);
    res.send(result);
  });
  // GET ADMIN
  app.get("/admin/:email", async (req, res) => {
    const email = req.params.email;
    const user = await userCollection.findOne({ email: email });
    const isAdmin = user.role === "admin";
    res.send({ admin: isAdmin });
  });
  // GET MY PROFILE
  app.get("/myProfile", verifyJWT, async (req, res) => {
    const email = req.query?.email;
    const decodedEmail = req.decoded.email;
    if (email === decodedEmail) {
      const query = { email: email };
      const myProfile = await userProfileCollection.find(query).toArray();
      return res.send(myProfile);
    } else {
      return res.status(403).send({ message: "Forbidden Access" });
    }
  });
  // update MY PROFILE
  app.put("/userProfile/:email", async (req, res) => {
    const email = req.params.email;
    const filter = { email: email };
    const user = req.body;
    const options = { upsert: true };
    const updateDoc = {
      $set: user,
    };
    const result = await userProfileCollection.updateOne(
      filter,
      updateDoc,
      options
    );
    res.send(result);
  });
  // MAKE ADMIN
  app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
    const email = req.params.email;
    const filter = { email: email };
    const updateDoc = {
      $set: { role: "admin" },
    };
    const result = await userCollection.updateOne(filter, updateDoc);
    res.send(result);
  });
  //   USER ADD ON DATABASE
  app.put("/user/:email", async (req, res) => {
    const email = req.params.email;
    const filter = { email: email };
    const user = req.body;
    const options = { upsert: true };
    const updateDoc = {
      $set: user,
    };
    const result = await userCollection.updateOne(filter, updateDoc, options);
    const token = jwt.sign({ email: email }, process.env.JWT_ACCESS_TOKEN, {
      expiresIn: "5h",
    });
    res.send({ result, token });
  });
  app.post("/order", async (req, res) => {
    const order = req.body;
    const result = await orderCollection.insertOne(order);
    res.send(result);
  });

  try {
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
