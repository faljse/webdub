import express from 'express';
import bodyParser from 'body-parser';
import udp from 'dgram';
import fs from 'fs';

declare global {
    interface String {
        paddingLeft(paddingValue: string): string;
    }
  }

class Main {
    config = null;
    client = null;
    httpPort = 8000;

    constructor() {
        let app = express();
        app.use(bodyParser.json())
        app.use('/', express.static('www'));
        let configText=fs.readFileSync('config.json').toString();
        this.config = JSON.parse(configText);
        this.client = udp.createSocket('udp4');

        app.get('/config', (req, res) => {
            res.type('json');
            res.send(configText);
        })

        app.post('/sendUDP', (req, res) => {
            let r:JsonUDP = req.body;
            let sendString = r.cmd.paddingLeft("    ")
                + "."+r.id.toString().paddingLeft("    ") 
                + "."+r.value.toString().paddingLeft("    ");
                + "\r\n"
            this.client.send(sendString, this.config.Port, this.config.Host);            
        })
        app.listen(this.httpPort, () => {
            console.log(`⚡️[server]: Server is running at https://localhost:${this.httpPort}`);
        });

    }
}

interface JsonUDP {
    id: number;
    cmd: string;
    value: number;
}
String.prototype.paddingLeft = function (paddingValue) {
    return String(paddingValue + this).slice(-paddingValue.length);
 };

let main=new Main();
