const express = require("express");
const app = express();
const axios = require('axios');
const url_API = "http://www.boredapi.com/api/activity/"
const path = require("path");

/* For http post */
const bodyParser = require("body-parser");
const { request } = require("http");
app.use(bodyParser.urlencoded({ extended: false }));

/* Middleware access (needed for css and images) */
app.use(express.static(path.join(__dirname, 'templates')));
app.use(express.static(path.join(__dirname, 'resources')));
app.use(express.static(path.join(__dirname, 'styles')));

/* Ejs template functionality */
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

/* MongoDB functionality */
require("dotenv").config({ path: path.resolve(__dirname, './.env') })
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_CONNECTION_STRING;

/* ENDPOINTS */
app.get("/", (request, response) => {
    response.render("index");
});

app.get("/main", (request, response) => {
    const variables = {
        
    };
    response.render("main", variables);
});

app.get("/join", (request, response) => {
    const variables = {
        
    };
    response.render("join", variables);
});

app.post("/processJoin", (request, response) => {
    const variables = {
        name: request.body.name,
        email: request.body.email,
        activities: []
    };

    addApplicant(request.body.name, request.body.email, [])
        .then(() => {
            response.render("processJoin", variables);
        })
        .catch(console.error);
});

app.get("/activityForm", (request, response) => {
    const variables = {
        
    };
    response.render("activityForm", variables);
});

app.post("/processActivity", (request, response) => {

    let email = request.body.email;

    getFromDB(email)
        .then(result => {
            if (result) {
                /* Formatting previous activities */
                let activitiesRslt = "<ul>";
                result.activities.forEach(elem => {
                    activitiesRslt += `<li>${elem}</li>`;
                })
                activitiesRslt += "</ul>";

                /* API Functionality: make GET request to BoredAPI */
                axios.get(url_API)
                    .then(apiResponse => {
                        /* Extract data from BoredAPI response */
                        let fetchedRslt = apiResponse.data.activity;

                        const variables = {
                            name: result.name,
                            email: email,
                            activities: activitiesRslt,
                            fetched_activity: fetchedRslt
                        };
                        /* Update users `activities` field by pushing fetchedRslt */
                        updateDB(email, fetchedRslt).catch(console.error);

                        response.render("processActivity", variables);
                    })
                    .catch(error => {
                        console.error("Error fetching activity from BoredAPI:", error);
                        // Handle error
                        response.status(500).send("An error occurred while fetching activity from BoredAPI");
                    });
            } else {
                /* No document found */
                const variables = {
                    name: "NONE",
                    email: "NONE",
                    activities: [],
                    fetched_activity: "NONE because email was not found in database"
                };
                response.render("processActivity", variables);
            }
        })
        .catch(error => {
            // Handle node server errors that occur 
            console.error("Error:", error);
            response.status(500).send("An error occurred while getting data from the database");
        });
});

/* Functions for MongoDB manipulation */
async function addApplicant(name, email, activities) {
    const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

    try {
        await client.connect();
        let applicant = { name: name, email: email, activities: activities };
        await insertApplicant(client, applicant);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function insertApplicant(client, applicant) {
    await client.db(process.env.MONGO_DB_NAME).collection(process.env.MONGO_COLLECTION).insertOne(applicant);
}

async function getFromDB(email) {
    const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

    try {
        await client.connect();
        return await lookUpOneEntry(client, email);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function lookUpOneEntry(client, emailName) {
    let filter = { email: emailName };
    const result = await client.db(process.env.MONGO_DB_NAME)
        .collection(process.env.MONGO_COLLECTION)
        .findOne(filter);

    if (result) {
        return (result);
    } else {
        return null;
    }
}

async function updateDB(email, newActivity) {
    const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

    try {
        await client.connect();

        await client.db(process.env.MONGO_DB_NAME)
            .collection(process.env.MONGO_COLLECTION)
            .updateOne(
                { email: email },
                { $addToSet: { activities: newActivity } }
            );
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

/* COMAND LINE FUNCTIONALITY */
const portNumber = process.argv[2];
process.stdin.setEncoding("utf8");

app.listen(portNumber);

function promptUser() {
    process.stdout.write("Stop to shutdown the server: ");
}

console.log(`Web server started and running at http://localhost:${portNumber}`);
promptUser();

process.stdin.on('readable', () => {
    const dataInput = process.stdin.read();
    if (dataInput !== null) {
        const command = dataInput.trim();
        if (command === "stop" || command === "Stop") {
            console.log("Shutting down the server");
            process.exit(0);  /* exiting */
        } else {
            console.log(`Invalid command: ${command}`);
            process.stdin.resume();
            promptUser();
        }
    }
});
