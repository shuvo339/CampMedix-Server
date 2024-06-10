const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken')
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://campmedix.web.app",
      "https://campmedix.firebaseapp.com"
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
    const feedbackCollection = client.db('campsDB').collection('feedback');
    const paymentCollection = client.db('campsDB').collection('payments');

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

    // use verify organizer after verifyToken
    const verifyOrganizer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isOrganizer = user?.role === 'organizer';
      if (!isOrganizer) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // use verify organizer after verifyToken
    const verifyParticipant = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isPartcipant = user?.role === 'participant';
      if (!isPartcipant) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    

    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    //user role entry related api
    app.put('/user', async (req, res) => {
      const user = req.body

      const query = { email: user?.email }
      // check if user already exists in db
      const isExist = await usersCollection.findOne(query)
      if (isExist) {
        return res.send(isExist)
      }

      // save new user 
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...user,
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)

      res.send(result)
    })

    app.get('/user/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      res.send(result)
    })


    //camp data
    app.get('/camps', async (req, res) => {
      const search = req.query.search || '';
      const sort = req.query.sort || '';
      const query = search ? { campName: { $regex: search, $options: 'i' } } : {};

      let sortOption = {};
      if (sort && sort === 'campName') {
        sortOption['campName'] = 1;
        const result = await campsCollection.find(query).sort(sortOption).toArray();
        return res.send(result);
      }
      else if (sort) {
        sortOption[sort] = -1;
      }
      try {
        const result = await campsCollection.find(query).sort(sortOption).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching camps', error });
      }
    });

    app.get('/popular-camps', async (req, res) => {
      const options = {
        sort: { participant: -1 },
      };
      const result = await campsCollection.find({},options).toArray();
      return res.send(result);
    })

    app.get('/camp/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await campsCollection.findOne(query);
      res.send(result)
    })

       //pagination and search camps api
       app.get('/manage-camps', verifyToken, verifyOrganizer, async(req,res)=>{
        const search = req.query.search;
        const email = req.query.email;
        const page = parseInt(req.query.page);
        let newpage=0;
        if(page===0){
         newpage = page;
        }else{
         newpage=page-1;
        }
        const size = parseInt(req.query.size);
        let query = {};
        if (email) {
          query.email = email;
        }
        if (search) {
          query.campName = { $regex: search, $options: 'i' };
        }
         const result = await campsCollection.find(query)
        .skip(newpage*size)
        .limit(size)
        .toArray();
        res.send(result)
      })

      app.get('/campscount-camps', async (req, res) => {
        const search = req.query.search;
        const email = req.query.email;
        let query = {};
        if (email) {
          query.email = email;
        }
        if (search) {
          query.campName = { $regex: search, $options: 'i' };
        }
        const count = await campsCollection.countDocuments(query);
        res.send({count})
      })
    
    

    app.post('/camps', async (req, res) => {
      const camp = req.body;
      const result = await campsCollection.insertOne(camp);
      res.send(result);
    })

    app.delete('/camp/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await campsCollection.deleteOne(query);
      res.send(result);
    })

    app.put('/camp/update/:id', async (req, res) => {
      const id = req.params.id
      const campData = req.body
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          campName: campData.campName,
          fees: campData.fees,
          date: campData.date,
          location: campData.location,
          opinion: campData.opinion,
          photo: campData.photo,
          professionalName: campData.professionalName,
          participant: campData.participant,
          description: campData.description
        }
      }
      const result = await campsCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    app.patch('/participant/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const participantValue = req.body;
      const updateDoc = {
        $set: {
          participant: participantValue.participantCount,
        },
      }

      const result = await campsCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    // registration related api 
    app.post('/register', async (req, res) => {
      const registrationData = req.body;
      const result = await registrationsCollection.insertOne(registrationData);
      res.send(result);
    })

    app.get('/register', async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { participantEmail: email }
      }
      const result = await registrationsCollection.find(query).toArray();
      res.send(result);
    })
    
 
    //pagination and search participant registered camps api
   app.get('/registers-participant', verifyToken, verifyParticipant, async(req,res)=>{
    const search = req.query.search;
    const email = req.query.email;
    const page = parseInt(req.query.page);
    let newpage=0;
    if(page===0){
     newpage = page;
    }else{
     newpage=page-1;
    }
    const size = parseInt(req.query.size);
    let query = {};
    if (email) {
      query.participantEmail = email;
    }
    if (search) {
      query.campName = { $regex: search, $options: 'i' };
    }
     const result = await registrationsCollection.find(query)
    .skip(newpage*size)
    .limit(size)
    .toArray();
    res.send(result)
  })

  app.get('/campscount-register', async (req, res) => {
    const search = req.query.search;
    const email = req.query.email;
    let query = {};
    if (email) {
      query.participantEmail = email;
    }
    if (search) {
      query.campName = { $regex: search, $options: 'i' };
    }
    const count = await registrationsCollection.countDocuments(query);
    res.send({count})
  })




       //pagination and search organizer registrer camps api
   app.get('/registers-organizer', verifyToken, verifyOrganizer, async(req,res)=>{
    const search = req.query.search;
    const email = req.query.email;
    const page = parseInt(req.query.page);
    let newpage=0;
    if(page===0){
     newpage = page;
    }else{
     newpage=page-1;
    }
    const size = parseInt(req.query.size);
    let query = {};
    if (email) {
      query.organizerEmail = email;
    }
    if (search) {
      query.campName = { $regex: search, $options: 'i' };
    }
     const result = await registrationsCollection.find(query)
    .skip(newpage*size)
    .limit(size)
    .toArray();
    res.send(result)
  })

  app.get('/campscount-organizer', async (req, res) => {
    const search = req.query.search;
    const email = req.query.email;
    let query = {};
    if (email) {
      query.organizerEmail = email;
    }
    if (search) {
      query.campName = { $regex: search, $options: 'i' };
    }
    const count = await registrationsCollection.countDocuments(query);
    res.send({count})
  })


    //chart data
    app.get('/campschart/:email', verifyToken, verifyParticipant, async (req, res) => {
      const email = req.params.email
      const query = { participantEmail: email }

      const options = {
        projection: {_id:0, fees: 1, campName: 1 },
      };
      const result = await registrationsCollection.find(query, options).toArray();
      res.send(result)
    })

    app.get('/register/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await registrationsCollection.findOne(query);
      res.send(result);
    })


    app.patch('/register/:id', async (req, res) => {
      const id = req.params.id
      const paymentStatus = req.body.paymentStatus;
      const query = { _id: new ObjectId(id) }
      const status = req.body.status;
      if (paymentStatus) {
        const updateDoc = {
          $set: {
            paymentStatus: paymentStatus,
          },
        }
        const result = await registrationsCollection.updateOne(query, updateDoc)
        res.send(result)
      }
      else {
        const updateDoc = {
          $set: {
            status: status,
          },
        }
        const result = await registrationsCollection.updateOne(query, updateDoc)
        res.send(result)
      }
    })

    app.delete('/register/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await registrationsCollection.deleteOne(query);
      res.send(result);
    })


    // feedback related api 
    app.get('/feedback', async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result)
    })

    app.post('/feedback', async (req, res) => {
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    })

    //payment related data
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    //pagination and search payment history api
   app.get('/payments/:email', verifyToken, verifyParticipant, async(req,res)=>{
    const email =req.params.email;
    let query = {};
    query = { email: email }
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
    const search = req.query.search;
    const page = parseInt(req.query.page);
    let newpage=0;
    if(page===0){
     newpage = page;
    }else{
     newpage=page-1;
    }
    const size = parseInt(req.query.size);
    
    if (email) {
      query.email = email;
    }
    if (search) {
      query.campName = { $regex: search, $options: 'i' };
    }
     const result = await paymentCollection.find(query)
    .skip(newpage*size)
    .limit(size)
    .toArray();
    res.send(result)
  })

  app.get('/campscount-payment', async (req, res) => {
    const search = req.query.search;
    const email = req.query.email;
    let query = {};
    if (email) {
      query.email = email;
    }
    if (search) {
      query.campName = { $regex: search, $options: 'i' };
    }
    const count = await paymentCollection.countDocuments(query);
    res.send({count})
  })

    // app.get('/payments/:email', verifyToken, verifyParticipant, async (req, res) => {
    //   const query = { email: req.params.email }
    //   if (req.params.email !== req.decoded.email) {
    //     return res.status(403).send({ message: 'forbidden access' });
    //   }
    //   const result = await paymentCollection.find(query).toArray();
    //   res.send(result);
    // })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      res.send(paymentResult);
    })

    app.patch('/paymentinfo/:id', async (req, res) => {
      const id = req.params.id
      const status = req.body.status;
      const query = { registerId: id }
      const updateDoc = {
        $set: {
          status: status,
        },
      }
      const result = await paymentCollection.updateOne(query, updateDoc)
      res.send(result)
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