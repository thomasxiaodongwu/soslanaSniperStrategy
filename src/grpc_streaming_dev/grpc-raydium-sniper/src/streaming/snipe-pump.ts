import {streamNewTokens} from "./raydium"
import {streamOpenbook} from "./openbook"
import {init} from "../transaction/transaction"
const {program} = require("commander")
let targetTokenToSnipe:string = "";

async function snipe(){
    console.log(`Siping ${targetTokenToSnipe}`)
    await init();
    if(targetTokenToSnipe!== ""){
      streamNewTokens("pump", targetTokenToSnipe)
      streamOpenbook("pump", targetTokenToSnipe)
    }else{
      streamNewTokens("pump", "");
      streamOpenbook("pump", "");
    }
}

snipe();