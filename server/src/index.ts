import GameServer from "./gameserver/GameServer";
import WebServer from "./webserver/WebServer";

const webServer = new WebServer();
const gameServer = new GameServer(5001);

webServer.start();
gameServer.start();