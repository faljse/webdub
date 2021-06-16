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
        let declCode="";

        declCode+=`Relay relay[${Object.keys(relay).length}];\r\n`;

        let idx=0;
        for (let id in relay) {
            let r=relay[id];
            r.idx=idx;
            lightCode+=`relay[${idx}] = Relay(${id}, ${r.output});\r\n`
            lightCode+=`pinMode(${r.output}, OUTPUT);\r\n`
            idx++;
        }
        declCode+=`Dimmer dimmer[${Object.keys(dimmer).length}];\r\n`;

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
        declCode+=`ActionSetGroup asg[${Object.keys(actionsetgroups).length}];\r\n`
        let asgMap=Object();
        for(let asg of actionsetgroups) {
            let asIdx=0;
            asgMap[asg.id]=asg;
            // declCode+=`ActionSet as${asgIdx};\r\n`
            declCode+=`Action actions${asgIdx}[${asg.actions.length}];\r\n`
            // actionCode+=`as${asgIdx}=ActionSet(1, ${asg.actions.length}, actions${asgIdx});\r\n`

            let aIdx=0;            
            for(let action of asg.actions) {
                if(action.idRelay) {
                    actionCode+=`actions${asgIdx}[${aIdx}] = Action(0, &relay[${relay[action.idRelay].idx}], CmdType::${action.cmd}, ${action.pos}${action.value?(", "+action.value):""});\r\n`
                }
                if(action.idDimmer) {
                    actionCode+=`actions${asgIdx}[${aIdx}] = Action(&dimmer[${dimmer[action.idDimmer].idx}],0, CmdType::${action.cmd}, ${action.pos}, ${action.value});\r\n`

                } 
                aIdx++;
            }
            asIdx++;
            
            asg.idx=asgIdx;
            actionCode+=`asg[${asgIdx}]=ActionSetGroup(${asg.id}, ${asg.actions.length}, actions${asgIdx});\r\n`
            asgIdx++;
        } 
        let buttons=config['Buttons'];
        let buttonsCode="";
        declCode+=`AnalogMultiButton buttons[${Object.keys(buttons).length}];\r\n`;
        let bIdx=0;
        buttonsCode+=`const int voltages[5] = {0, 111, 170, 232, 362};\r\n`

        for(let id in buttons) {
            let button = buttons[id];
            buttonsCode+=`const ActionSetGroup *asg_b${id}[4] = {&asg[${asgMap[button.A].idx}], &asg[${asgMap[button.B].idx}], &asg[${asgMap[button.C].idx}], &asg[${asgMap[button.D].idx}]};\r\n`

            buttonsCode+=`buttons[${bIdx}] = AnalogMultiButton(${button.input}, 5, voltages, asg_b${id}, 20, 1024);\r\n`
            buttonsCode+=`pinMode(${button.input}, INPUT);\r\n`


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
#include "analogmultibutton.h"
#include "buttonaction.h"\r\n\r\n`


header+=declCode;

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
