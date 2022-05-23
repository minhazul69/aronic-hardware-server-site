const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

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
  //   FIND ALL PRODUCT
  app.get("/products", async (req, res) => {
    const result = await productCollection.find().toArray();
    res.send(result);
  });
  //   FIND PRODUCT ON ID
  app.get("/product/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await productCollection.findOne(query);
    res.send(result);
  });

  //   PRODUCT QUANTITY UPDATE
  app.put("/product/:id", async (req, res) => {
    const id = req.params.id;
    console.log(id);
    const updateUser = req.body;
    console.log(updateUser.quantity);
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
  //   GET MY ALL ORDER
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
  //   DELETE MY ORDER
  app.delete("/order/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await orderCollection.deleteOne(query);
    res.send(result);
  });
  //   USER REVIEW ADDED
  app.post("/review", async (req, res) => {
    const product = req.body;
    const result = await reviewCollection.insertOne(product);
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
