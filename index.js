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


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const campsCollection = client.db('campsDB').collection('camps');
    const usersCollection = client.db('campsDB').collection('users');
    const registrationsCollection = client.db('campsDB').collection('registrations');

        //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      console.log('token test', token );
      res.send({ token })
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }
    

    //user role entry related api
  app.put('/user', async (req, res) => {
      const user = req.body

      const query = { email: user?.email }
      // check if user already exists in db
      const isExist = await usersCollection.findOne(query)
      // if (isExist) {
      //   if (user.status === 'Requested') {
      //     // if existing user try to change his role
      //     const result = await usersCollection.updateOne(query, {
      //       $set: { status: user?.status },
      //     })
      //     return res.send(result)
      //   } else {
      //     // if existing user login again
      //     return res.send(isExist)
      //   }
      // }

      // save user for the first time
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...user,
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
     
      res.send(result)
    })

    app.get('/users', async(req,res)=>{
      const result = await usersCollection.find().toArray();
      res.send(result)
    })



    //camps related api
    app.get('/camps', async(req,res)=>{
      const search = req.query.search || '';
      const sort = req.query.sort || 'fees';
      const query = search ? { campName: { $regex: search, $options: 'i' } } : {}
      const options = {
        // Sort returned documents in ascending order by title (A->Z)
        sort: { [sort]: 1 },
        
      };
      const result = await campsCollection.find().toArray();
      res.send(result)
    })

    app.get('/popular-camps', async(req,res)=>{
      const options = {
        // Sort returned documents in ascending order by title (A->Z)
        sort: { participant: -1 },
      };
      const result = await campsCollection.find({}, options).toArray();
      res.send(result)
    })

    app.get('/camps/:id', async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await campsCollection.findOne(query);
      res.send(result)
    })
  
    app.post('/camps', async(req,res)=>{
      const camp = req.body;
      const result = await campsCollection.insertOne(camp);
      res.send(result); 
    })


      //   app.patch('/participant/:id', async (req, res) => {
      // const id = req.params.id;
      // console.log(id);
      // const filter = { _id: new ObjectId(id) }
      // const updateDoc ={
      //   $set: {
      //     "participant": parseInt()
          
      //   }
      // }
    //  const result = await campsCollection.updateOne(filter, {$inc: {participant: 1}})
    // res.send(result);
    // })

    // registration related api 


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