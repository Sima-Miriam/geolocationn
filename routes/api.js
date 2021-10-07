var express = require('express');
var CircularJSON = require('circular-json');
var router = express.Router();

const {MongoClient}=require('mongodb');

var CircularJSON = require('circular-json');
var axios = require("axios").default;

const uri="mongodb+srv://SimaMiriam:0585219821@cluster0.ms9tz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

const client = new MongoClient(uri);



/* GET users listing. */
router.get('/', function(req, res, next) {

   res.status(200).send();//sending an error , so that the client should move the user to the login page
});


router.get('/dest/source/:theSource/destination/:theDestination',  async function(req, res, next) {

    const points=[req.params.theSource,req.params.theDestination];
    points.sort()
    try {
        //connection to the db and searching
        await client.connect();
        const result = await client.db("syn").collection("project").findOne({
            source: points[0],
            destination: points[1]
        });

        if (result)//add one to search and return
        {
           await  upsert(points, (result.hits + 1), result.distance);
            res.status(200).send("distance " + result.distance);
        } else//send an api call, insert into the db and return km
           await getDistanceAndInsert(points, res);
    }
    catch(error)
    {
        res.status(500).send(error);
    }






 });

async function upsert(points,amount,dst)
{
//updating number of hits and distance, or inserting in case not found
   try {
      const result = await client.db("syn").collection("project").updateOne({
         "source": points[0],
         "destination": points[1]
      }, {
         $set: {distance: dst, hits: amount}
      }, {upsert: true});
   }
   catch(error)
   {
      console.log("error connection to db", error);

   }
   finally{
       await client.close();
   }


}
router.get('/health', async function(req, res, next) {
//test the connectivity
     try
     {
        await client.connect();
         const list= client.db().admin().listDatabases();
         res.status(200).send();
     }
     catch (Exception)
     {
         res.status(500).send("connection to DB is not okay");
    }

});
router.get('/popularsearch', async function(req, res, next) {

   try {
      await client.connect();
      let body;
      //sorting document to find the one with the most hits
      const result = await client.db("syn").collection("project").find().sort({hits: -1}).limit(1).toArray();
      if (result.length)//in case document is empty
         body = {"source": result[0].source, "destination": result[0].destination, "hits": result[0].hits};
      else
         body = {"source": "none", "destination": "none", "hits": 0};
      res.status(200).json(body);
   }
   catch{
      console.log("error ", error);
      res.status(500).send("error with database");
   }
   finally{
      await client.close();

    }

});
router.post('/distance',   async function (req, res, next) {
     try {
         const [source,destination,distance]=[req.body.source,req.body.destination,req.body.distance];
        if (!(source && destination && distance) || isNaN(distance))//validating arguments
            res.status(422).send("error with parameters (missing parameters or distance is not a number");
        else {
            const points = [destination.trim(), source.trim()];
            points.sort();
            let hits = 0;
            await client.connect()
            const connection = await client.db("syn").collection("project");
            const result = await connection.findOneAndUpdate({
                "source": points[0],
                "destination": points[1]
            }, {
                $set: {"distance": distance}
            });
            if (!result.lastErrorObject.updatedExisting)
                connection.insertOne({source: points[0], destination: points[1], distance: distance, hits: 0});
            else
                hits = result.value.hits;
            let body = {"source": points[0], "destination": points[1], "hits": hits};
            res.status(201).json(body);
        }
    }
    catch(error)
        {
            console.log(error);
            res.status(500).send("error  inserting")
        }

});
function getDistanceAndInsert(points,res)
{


    var options = {
        method: 'GET',
        url: 'https://distanceto.p.rapidapi.com/get',
        params: {route: `[{"t":"${points[0]}"},{"t":"${points[1]}"}]`, car: 'false', foot: 'false'},

        headers: {
            'x-rapidapi-host': 'distanceto.p.rapidapi.com',
            'x-rapidapi-key': '322489a846msh1025401faf12874p19c9c2jsn0ec23b7133fa'
        }
    };

    axios.request(options).then(async function (response) {
        let dist = await CircularJSON.stringify(response.data.steps[0].distance.haversine);
        await upsert(points, 1, dist);
        res.status(200).send("distance " + dist);
    }).catch(function(error){
       console.log(error);
       res.status(500).send("error with parameters or with the api call to get the distance");
    });
}



module.exports = router;

