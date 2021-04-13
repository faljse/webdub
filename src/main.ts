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
    client: udp.Socket = null;
    httpPort = 8000;

    constructor() {
        this.buildConfig();
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
            // let sendString = r.cmd.paddingLeft("    ")
            //     + "."+r.id.toString().paddingLeft("    ") 
            //     + "."+r.value.toString().paddingLeft("    ");
            //     + "\r\n"
            let sendData= new Uint8Array(2); 
            sendData[0]=2;
            sendData[1]=r.id;
            this.client.send(sendData, this.config.Port, this.config.Host);   
            res.send();
        })
        app.listen(this.httpPort, () => {
            console.log(`⚡️[server]: Server is running at https://localhost:${this.httpPort}`);
        });

    }
    bAIdx=0;
    buildConfig() {
        let configText=fs.readFileSync('config.json').toString();
        let config = JSON.parse(configText);
        let lights=config['Lights'];
        let lightCode="";
        let idx=0;
        for (let id in lights) {
            let light=lights[id];
            light.idx=idx;
            if(light.type=="Relay") {
                lightCode+=`lights[${idx}] = new Relay(${id}, ${light.output});\r\n`
            }
            else if(light.type=="Dimmer") {
                lightCode+=`lights[${idx}] = new Dimmer(${id}, ${light.dmxCh});\r\n`
            }
            idx++;
        }

        let actionsets=config['ActionSets'];
        let actionCode="";
        let aIdx=0;
        for(let id in actionsets) {
            let aset=actionsets[id];
            for(let action of aset.actions) {              
                actionCode+=`actions[${aIdx}] = new Action(${id}, ${lights[action.idLight].idx}, CmdType::${action.cmd}${action.value?(", "+action.value):""});\r\n`
                aIdx++;
            }
        }
        let buttons=config['Buttons'];
        let buttonsCode="";
        let bIdx=0;
        
        for(let id in buttons) {
            let button = buttons[id];
            console.log(button);
            buttonsCode+=`buttons[${bIdx}] = new MButton(${id}, ${button.input});\r\n`
            buttonsCode+=this.buildbuttonaction(Number(id), 0, button.A, buttonsCode);
            buttonsCode+=this.buildbuttonaction(Number(id), 1, button.B, buttonsCode);
            buttonsCode+=this.buildbuttonaction(Number(id), 2, button.C, buttonsCode);
            buttonsCode+=this.buildbuttonaction(Number(id), 3, button.D, buttonsCode);

            bIdx++;
        }
        let header=`#ifndef CONFIG_H
#define CONFIG_H

#include <Controllino.h>
#include "light.h"
#include "dimmer.h"
#include "relay.h"
#include "action.h"
#include "mbutton.h"
#include "buttonaction.h"\r\n\r\n`

        header+=`Light *lights[${idx}];\r\n`;
        header+=`Action *actions[${aIdx}];\r\n`;
        header+=`MButton *buttons[${bIdx}];\r\n`;
        header+=`ButtonAction *buttonactions[${this.bAIdx}];\r\n\r\n`;
        header+=`void buildConfig() {\r\n`;

        header+=lightCode;
        header+=actionCode;
        header+=buttonsCode;
        header+=`}
#endif`

        console.log(header);       
    }

    buildbuttonaction(buttonId: number, buttonSubId: number, actionids: number[], buttonsCode: string) :string {
        let code="";
        for(let i=0;i!=actionids.length; i++) {
            code+=`buttonactions[${this.bAIdx++}] = new ButtonAction(${buttonId}, ${buttonSubId}, ${actionids[i]});\r\n`
        }
        return code;
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
