import {Button, Stack, TextField }from '@mui/material';
import { useState } from 'react'
import { useGameConnection } from './hooks/useGameConnection';

function App() {

  type Cell ={
    x:number,
    y:number,
  }

  type GameState = {
    conf:Map<string,number>,
    turn:number,
    started: boolean,
  }

  const [roomName, setRoomName] = useState("");
  const [nickname, setNickname] = useState("");
  const [gameState, setGameState] = useState<GameState>(init());
  const scale = 100;

  const directions = [
    [1, 0], [-1, 0],
    [0, 1], [0, -1],
    [-1, 1], [1, -1]
  ];


  const {me, dataStream, joinRoom, players}:any = useGameConnection();

  function imhost(me:any, players:any){
    if (players.length == 0) return false;
    return (players[0].id === me.id);
  }
  
  function receiver(msg:any) {
    console.log(msg);
    setGameState((prev:GameState) => {
      if (msg.newState !== null){
	return({conf: new Map(msg.newState.conf),
		started: msg.newState.started,
		turn: msg.newState.turn
	});
      }
      else{
	return(prev);
      }
    });
  }
  
  function send(m:any){
    if (!(m.newState)) return;
    const arrstate = {conf: Array.from(m.newState.conf.entries()),
		      turn: m.newState.turn,
		      started:m.newState.started,
    }
    console.log(JSON.stringify({newState:arrstate}));
    dataStream.write(JSON.stringify({newState:arrstate}))
  }  
  
  function key(x:number, y:number){
    return ""+x+","+y;
  }

  function decodeKey(k:string) {
    const [x, y] = k.split(',').map(Number);
    return {x:x, y:y };
  }

  // Check if (x,y) is inside triangular board
  function isValidCell(x:number, y:number) {
    return 0 <= x && x < 8 && 0 <= y && y < 8 && x + y < 8;
  }

  
  function init(){
    const conf = new Map<string,number>();
    for (let x = 0; x < 8; x++){
      for (let y = 0; y < 8; y++){
	if (x + y < 8){
	  conf.set(key(x,y),-1);
	}
      }
    }
    conf.set(key(2,2),0);
    conf.set(key(3,3),0);
    conf.set(key(4,1),0);
    conf.set(key(1,2),1);
    conf.set(key(2,3),1);
    conf.set(key(3,1),1);
    conf.set(key(1,3),2);
    conf.set(key(2,4),2);
    conf.set(key(3,2),2);
    //console.log(state);
    return {conf:conf,turn:0,started:false};
  }

  function pass(conf:Map<string,number>, turn:number){
    for (let x = 0; x < 8; x++){
      for (let y = 0; y < 8; y++){
	if (canPut(conf, {x:x,y:y},turn)){
	  return(false);
	}
      }
    }
    return(true);
  }

  function gameOver(conf:Map<string,number>){
    for (let turn = 0; turn < 3; turn++){
      if (!pass(conf, turn)){
	return(false);
      }
    }
    return(true);
  }
  
  function click(cell:Cell){
    const newconf = new Map();
    gameState.conf.forEach((v,k)=>{
      newconf.set(k,v);
    })
    if (canPut(gameState.conf, cell,gameState.turn)){
      newconf.set(key(cell.x,cell.y),gameState.turn);
      for (const [dx, dy] of directions) {
	for (let c of getFlipsInDirection(gameState.conf, cell, dx, dy,gameState.turn)){
	  newconf.set(c,gameState.turn);
	}
      }
    }
    else{
      return;
    }
    const turn = gameState.turn;
    if (pass(newconf,(turn+1)%3) && pass(newconf,(turn+2)%3)){
      console.log("pass");
      setGameState({conf:newconf, turn:(gameState.turn+3)%3, started:true});  
      send({newState:{conf:newconf, turn:(gameState.turn+3)%3, started:true}});  
    }
    else if (pass(newconf,(turn+1)%3)){
      setGameState({conf:newconf, turn:(gameState.turn+2)%3, started:true});
      send({newState:{conf:newconf, turn:(gameState.turn+2)%3, started:true}});
    }
    else{
      setGameState({conf:newconf, turn:(gameState.turn+1)%3, started:true});
      send({newState:{conf:newconf, turn:(gameState.turn+1)%3, started:true}});
    }
  }


  // Get the list of cells that would flip in one direction
  function getFlipsInDirection(board: Map<string, number>, cell:Cell, dx:number, dy:number, player:number) {
    //const board = gameState.conf;
    //const player = gameState.turn;
    const x = cell.x;
    const y = cell.y;
    const flips = [];
    let nx = x + dx;
    let ny = y + dy;
    const val = board.get(key(nx, ny));
    while (isValidCell(nx, ny) && board.has(key(nx,ny)) && val !== undefined && val>=0 ) {
      const other = board.get(key(nx, ny));
      if (other === player) {
	return flips.length > 0 ? flips : [];
      } else {
	flips.push(key(nx, ny));
      }
      nx += dx;
      ny += dy;
    }
    return []; // no valid flips in this direction
  }

  // Check if player can put a stone at (x,y)
  function canPut(board:Map<string,number>, cell:Cell, player:number) {
    const x = cell.x;
    const y = cell.y;
    const val = board.get(key(x, y))
    if (!isValidCell(x, y) || val === undefined || val >= 0) return false;

    for (const [dx, dy] of directions) {
      if (getFlipsInDirection(board, cell, dx, dy, player).length > 0) {
	return true;
      }
    }

    return false;
  }
  
  function Cell({cell,color,canPut}:{cell:Cell,color:number,canPut:boolean}){
    const px = cell.x + 0.5*cell.y;
    const py = Math.sqrt(3)/2*cell.y;
    const I = [0,1,2,3,4,5];
    const x = I.map((i)=>scale*Math.cos(2*Math.PI/6*(i+0.5))/Math.sqrt(3));
    const y = I.map((i)=>scale*Math.sin(2*Math.PI/6*(i+0.5))/Math.sqrt(3));
    let points = "";
    for (let i = 0; i < 6; i++){
      points += (" " + x[i] + " " + y[i] + " ");
    }
    const transform = "translate("+scale*px+","+scale*py+")";
    const stone = ["none","black","white","red"][color+1]
    return(
      <g transform={transform} onClick={()=>click(cell)}>
	<polygon stroke="black" fill={"green"} points={points}/>
	<circle fill={stone} r={scale/3}/>
	{canPut? <circle fill={"limegreen"} r="10"/> : <></>}
      </g>
    )
  }


  function Board(){
    const board:any[] = [];
    gameState.conf.forEach((color,cell)=>{
      board.push(<Cell cell={decodeKey(cell)} color={color}
		       canPut={canPut(gameState.conf, decodeKey(cell), gameState.turn)}/>);
    })
    return(<g transform={"translate("+scale+","+scale+")"}> {board} </g>);
  }

  function Turn(){
    return <h1> {players[gameState.turn].nickname + "さんの番です"} </h1>;
  }
  
  function start(){
    const newState = {conf:gameState.conf,
		      started: true,
		      turn:0}
    send({newState:newState})
    console.log(newState)
    setGameState((_)=>newState);
  }
  
  return (
    <>
      {(me === null)? //通信路が確立していない。
       (<Stack direction={"row"}>
	 <Button variant='contained'
		 onClick={()=>{joinRoom(roomName,nickname,receiver)}}
	 >Join</Button>
	 <TextField placeholder='room'
		    onChange={(e)=>{setRoomName(e.target.value)}}
	 ></TextField>
	 <TextField  placeholder='nickname'
		     onChange={(e)=>{setNickname(e.target.value)}}    
	 ></TextField>
       </Stack>
       )
     : // 通信路が確立してmeが定まっている時
       ((gameState.started)?
	(<>
	  {gameOver(gameState.conf) ? <h1> Game Over </h1> : <Turn /> }
	  <Stack direction={"row"}>
	    <svg width="900" height="800">
	      <Board/>
	    </svg>
	  </Stack>
	</>
	):
	(
	  <Stack>
	    {imhost(me,players) ?
	     (<Button variant="contained" onClick={(_)=>start()}> start </Button>)
	    : <></>}
	  </Stack>
	)
       )
    }
    {roomName} {nickname}
    <ol>
    {
      players.map((player:{id:string,nickname:string}) => <li>{player.nickname + " : " + player.id}</li>)
    }
    </ol>
    </> 
  )
}

export default App
