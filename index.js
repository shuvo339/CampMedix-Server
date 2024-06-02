const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken')
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v8mpgvp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//middleware
// const verifyToken = async (req, res, next) => {
//   const token = req.cookies?.token;
//   console.log('token in middleware', token)
//   if (!token) {
//       return res.status(401).send({ message: 'unauthorized access' })
//   }
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//       if (err) {
//         console.log(err)
//           return res.status(401).send({ message: 'unauthorized access' })
//       }
//       console.log('docoded', decoded)
//       req.user = decoded;
//       next();
//   })
// }

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const campsCollection = client.db('campsDB').collection('camps');

    //jwt token generate
    
    //clearing Token


    //camps related api
    app.get('/camps', async(req,res)=>{
      const search = req.query.search || '';
      const sort = req.query.sort || 'fees';
      console.log(search);
      const query = search ? { campName: { $regex: search, $options: 'i' } } : {}
      const options = {
        // Sort returned documents in ascending order by title (A->Z)
        sort: { [sort]: 1 },
        
      };
      const result = await campsCollection.find().toArray();
      res.send(result)
    })
  
    app.post('/camps', async(req,res)=>{
      const camp = req.body;
      const result = await campsCollection.insertOne(camp);
      res.send(result); 
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Welcome to CampMedix Server')
})

app.listen(port, () => {
  console.log(`CampMedix server is running on port ${port}`)
})