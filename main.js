// load libraries
const express = require('express');
const bodyParser = require('body-parser');
const secureEnv = require('secure-env');
const cors = require('cors');
const mysql = require('mysql2/promise');

// environment configuration
global.env = secureEnv({ secret: 'isasecret' });
const APP_PORT = global.env.APP_PORT;
const COMMON_NAMESPACE = '/api';
const SQL_GET_ALL_RSVPS = 'select * from rsvp';
const SQL_INSERT_RSVP = 'insert into rsvp (name, email, phone, status, createdBy, createdDate) values (?, ?, ?, ?, ?, CURDATE())';

// create db connection pool
const pool = mysql.createPool({
    host: global.env.MYSQL_SERVER,
    port: global.env.MYSQL_SERVER_PORT,
    user: global.env.MYSQL_USERNAME,
    password: global.env.MYSQL_PASSWORD,
    database: global.env.MYSQL_SCHEMA,
    connectionLimit: global.env.MYSQL_CONN_LIMIT
});

// Closure for functions to make queries to db with connection in pool
const makeQuery = (sql, pool) => {
    return (async (args) => {
        const conn = await pool.getConnection();
       
        try {
            const results = await conn.query(sql, args || []);
            return results[0];
        } catch(e) {
            console.error('Error getting connection from pool: ', e);
        } finally {
            conn.release();
        }
    });
};

// Create functions from closure
const getAllRsvps = makeQuery(SQL_GET_ALL_RSVPS, pool);
const saveRsvp = makeQuery(SQL_INSERT_RSVP, pool);

// create an instance of express
const app = express();

// resources
app.use(cors());
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));

app.get(`${COMMON_NAMESPACE}/rsvps`, async (req, res) => {
    const results = await getAllRsvps();
    // console.log('SQL results: ', results);

    res.status(200);
    res.type('application/json');
    res.json(results);
});

app.post(`${COMMON_NAMESPACE}/rsvp`, async (req, res) => {
    const bodyValue = req.body;
    // console.log('Body: ', bodyValue);

    let results;

    try {
        results = await saveRsvp([ 
            bodyValue.name, 
            bodyValue.email, 
            bodyValue.phone,
            bodyValue.status,
            1
        ]);
    } catch(e) {
        console.error('Error in inserting rsvp: ', e);
    }

    res.status(200);
    res.type('application/json');
    // res.json({ 'Ok': 'Insert record successfully!' });
    res.json(results);
});

// test db connection before starting the server
const startApp = async (app, pool) => {
    try {
        // get a connection from the connection pool
        const conn = await pool.getConnection();
        console.info(`Pinging database...`);
        
        await conn.ping();

        // release the connection
        conn.release();
        console.info(`Pinging database successfully.`);

        app.listen(APP_PORT, ()=> {
            console.info(`Application started on PORT ${APP_PORT} at ${new Date()}`);
        });
    } catch(e) {
        console.error('Failed to ping database: ', e);
    }
};

// start server
startApp(app, pool);