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
        let relay=config['Relay'];
        let dimmer=config['Dimmer'];
        let lightCode="";


        lightCode+=`Relay relay[${Object.keys(relay).length}];\r\n`;
        lightCode+=`Dimmer dimmer[${Object.keys(dimmer).length}];\r\n`;

        let idx=0;
        for (let id in relay) {
            let r=relay[id];
            r.idx=idx;
            lightCode+=`relay[${idx}] = Relay(${id}, ${r.output});\r\n`
            lightCode+=`pinMode(${r.output}, OUTPUT);\r\n`
            idx++;
        }

        idx=0;
        for (let id in dimmer) {
            let d=dimmer[id];
            d.idx=idx;
            lightCode+=`dimmer[${idx}] = Dimmer(${id}, ${d.dmxCh});\r\n`
            idx++;
        }


        let actionsetgroups=config['ActionSetGroups'];
        let actionCode="";
        let asgIdx=0;
        actionCode+=`ActionSetGroup asg[${Object.keys(actionsetgroups).length}];\r\n`

        for(let asg of actionsetgroups) {
            let asIdx=0;
            for(let actionset of asg.actions) {
                actionCode+=`Action actions${asgIdx}_${asIdx}[${actionset.length}];\r\n`
                actionCode+=`ActionSet as${asgIdx}_${asIdx}[${asg.actions.length}];\r\n`
                let aIdx=0;
                for(let action of actionset) {
                    if(action.idRelay) {
                        actionCode+=`actions${asgIdx}_${asIdx}[${aIdx}] = Action(&relay[${relay[action.idRelay].idx}], CmdType::${action.cmd}${action.value?(", "+action.value):""});\r\n`
                    }
                    console.log(action.idDimmer);
                    if(action.idDimmer) {
                        actionCode+=`actions${asgIdx}_${asIdx}[${aIdx}] = Action(&dimmer[${dimmer[action.idDimmer].idx}], CmdType::${action.cmd}${action.value?(", "+action.value):""});\r\n`
 
                    } 
                    aIdx++;
                }
                actionCode+=`as${asgIdx}_${asIdx}[${asIdx}]=ActionSet(1, ${actionset.length}, actions${asgIdx}_${asIdx});\r\n`
                asIdx++;
            }
            console.log("asg");
            console.log(asg);
            actionCode+=`asg[${asgIdx}]=ActionSetGroup(${asg.id}, ${asg.actions.length}, as${asgIdx}_${asIdx-1});\r\n`
            asgIdx++;
        } 
        let buttons=config['Buttons'];
        let buttonsCode="";
        let bIdx=0;
        
        for(let id in buttons) {
            let button = buttons[id];
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
#include "dimmer.h"
#include "relay.h"
#include "action.h"
#include "actionset.h"
#include "actionsetgroup.h"
#include "mbutton.h"
#include "buttonaction.h"\r\n\r\n`

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
