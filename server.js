const express = require('express');
const bodyParser = require('body-parser')
const MongoClient = require('mongodb').MongoClient
const WebSocketServer = require('ws').Server
const amqp = require('amqplib')
//Will be used to display host/container info
const os = require('os')

const app = express()

const RABBIT_MQ_HOST = process.env.RABBIT_MQ_HOST

const MONGODB_HOST = process.env.MONGODB_HOST
const MONGODB_PORT = process.env.MONGODB_PORT

const MONGODB_URL = 'mongodb://' +  MONGODB_HOST + ':' + MONGODB_PORT
const RABBIT_MQ_URL = 'amqp://' + RABBIT_MQ_HOST

const SERVER_PORT = 3000
const WEBSOCKET_PORT = 40510

app.set('view engine', 'ejs')

app.use(bodyParser.urlencoded({ extended: true}))

app.listen(SERVER_PORT, () => {
    console.log('listening on port: ' + SERVER_PORT)
})
const HOSTNAME = os.hostname();

let wsClients = []

MongoClient.connect(MONGODB_URL, {useUnifiedTopology: true})
.then(client => {
    console.log("Connected to MongoDB")
    const db = client.db('syncMsg')
    const msgCollection = db.collection("messages")

    amqp.connect(RABBIT_MQ_URL)
    .then((amqpConnection) => {
        console.log("Connected to RabbitMq: ", amqpConnection.connection.serverProperties.cluster_name)
        amqpConnection.createChannel().then((channel) => {
            console.log("Creating a queue")
            channel.assertQueue('queue1', {durable:true})

            channel.consume('queue1', (msg) => {
                console.log('received a messsage from rabbitMq: ', JSON.stringify(msg.content.toString()))

                wsClients.forEach((ws) => {
                            console.log("Sending message through websocket to " + ws)
                            ws.send(JSON.stringify(msg.content.toString()))

                 })


            }, {
                 noAck: true})

            const wss = new WebSocketServer({port: WEBSOCKET_PORT})

            wss.on('connection', (ws) => {
                console.log('New session')
                wsClients.push(ws)

                ws.on('close', (obj) => {
                    console.log("Closing wesocket")
                    let index = wsClients.indexOf(ws)
                    wsClients.splice(index, 1)
                })
            })


            app.use(express.static('public'))

            app.get('/' , (req, res) => {

                  console.log(`Received ${req.method} request to ${req.url}`)
                const cusror = msgCollection.find()

                cusror.toArray().then((data) => {


                 res.render('index.ejs', {messages:data})


                 })
            })

            //REST API END POINT
            app.post('/' , (req, res) => {
                 console.log(`Received ${req.method} request to ${req.url}`)

                msgCollection.insertOne(req.body).then(() => {
                    console.log('Inserted a new entry in the database')
                }).then(() => {
                    channel.sendToQueue('queue1', Buffer.from(JSON.stringify(req.body)))
                    console.log('Message send to rabbitMQ')
                })

                res.send()
            })

            app.get('/template', (req, res) => {
                res.render('template.ejs')
            })

            
        }).catch((error) => {
            console.log("Can't connect to RabitMQ server")
            console.log(error)
        })
    })

}).catch(() => {
    console.log("Can't connect to MongoDB server")
    process.exit()
})


