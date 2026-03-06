// max heap/min heap(-y)
/* Simple binary max/min heap where the key is the car's y.
   The heap stores objects {y, id} */
class MaxMinHeap {
  constructor(onRootChange) {
    this.heap = [];          // array of {y, id}
    this.idMap = new Map();  // id -> index in heap (for O(log n) updates)
    this._onRootChange = onRootChange; // called when root id changes
    this._prevRootId = null; // keep previous root for comparison
  }

  _swap(i, j) {
    const tmp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = tmp;
    this.idMap.set(this.heap[i].id, i);
    this.idMap.set(this.heap[j].id, j);
  }

  _heapifyUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].y >= this.heap[i].y) break;
      this._swap(i, p);
      i = p;
    }
  }

  _heapifyDown(i) {
    const n = this.heap.length;
    while (true) {
      let largest = i;
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      if (l < n && this.heap[l].y > this.heap[largest].y) largest = l;
      if (r < n && this.heap[r].y > this.heap[largest].y) largest = r;
      if (largest === i) break;
      this._swap(i, largest);
      i = largest;
    }
  }

  insert(id, y) {
    const node = {id, y};
    this.heap.push(node);
    const idx = this.heap.length - 1;
    this.idMap.set(id, idx);
    this._heapifyUp(idx);
    this._checkRootChange(); // insertion may affect the root
  }

  // called each frame when a car's y changes
  update(id, newY) {
    const i = this.idMap.get(id);
    if (i === undefined) return;
    const oldY = this.heap[i].y;
    this.heap[i].y = newY;
    if (newY > oldY) this._heapifyUp(i);
    else this._heapifyDown(i);
    this._checkRootChange(); // after every update we test the root
  }

  // root change detection
  _checkRootChange() {
    const currentRootId = this.heap.length ? this.heap[0].id : null;
    if (currentRootId !== this._prevRootId) {
      this._prevRootId = currentRootId;
      if (typeof this._onRootChange === 'function') {
        this._onRootChange(currentRootId);
      }
    }
  }

  // return the top *k* elements
  topK(k) {
    // copy heap and pop k times
    const copy = this.heap.slice();
    const result = [];
    const tempHeap = new MaxMinHeap();
    tempHeap.heap = copy;
    tempHeap.idMap = new Map(copy.map((n, i) => [n.id, i]));
    for (let i = 0; i < k && tempHeap.heap.length; i++) {
      const top = tempHeap.heap[0];
      result.push(top);
      // remove top
      const last = tempHeap.heap.pop();
      if (tempHeap.heap.length) {
        tempHeap.heap[0] = last;
        tempHeap.idMap.set(last.id, 0);
        tempHeap._heapifyDown(0);
      }
    }
    return result;
  }
}



const carCanvas=document.getElementById("carCanvas");
carCanvas.width=200;
const networkCanvas=document.getElementById("networkCanvas");
networkCanvas.width=300;


let bestCarId = null;   // id of the bestcar that is currently tracked
const BESTCAR_TOLERANCE = 0.001; // prevents jitter when values are equal


const heap = new MaxMinHeap(onHeapRootChange);

const leaderboard = document.getElementById('list');


let startButton = document.getElementById("startBtn");
let saveButton = document.getElementById("saveBtn");
let discardButton = document.getElementById("discardBtn");
let pauseButton = document.getElementById("pauseBtn");
let resumeButton = document.getElementById("resumeBtn");
let networkButton = document.getElementById("neuralNet");

let carAmount = document.getElementById("carAmt").value;
let mutAmount = document.getElementById("mutAmt").value;



const carCtx = carCanvas.getContext("2d");
const networkCtx = networkCanvas.getContext("2d");



const road=new Road(carCanvas.width/2,carCanvas.width*0.9);

let animRequest = null;

let N = carAmount;

let mutationAmt = 0.1;


const cars=generateCars(N);


let bestCar=cars[0];
if(localStorage.getItem("bestBrain")){
    for(let i=0;i<cars.length;i++){
        cars[i].brain=JSON.parse(localStorage.getItem("bestBrain"));
        if(i!=0){
            NeuralNetwork.mutate(cars[i].brain,mutationAmt);
        }
    }
}
    
let traffic=[
    new Car(road.getLaneCenter(1),-100,30,50,"DUMMY",2,getRandomColor()),
    new Car(road.getLaneCenter(0),-300,30,50,"DUMMY",2,getRandomColor()),
    new Car(road.getLaneCenter(2),-300,30,50,"DUMMY",2,getRandomColor()),
    new Car(road.getLaneCenter(0),-500,30,50,"DUMMY",2,getRandomColor()),
    new Car(road.getLaneCenter(1),-500,30,50,"DUMMY",2,getRandomColor()),
    new Car(road.getLaneCenter(1),-700,30,50,"DUMMY",2,getRandomColor()),
    new Car(road.getLaneCenter(2),-700,30,50,"DUMMY",2,getRandomColor()),
];


function toggleNeuralView(){
    if (networkCanvas.style.display === "none") {
        networkCanvas.style.display = "block";
    } else {
        networkCanvas.style.display = "none";
    }
}

function start(){
    carCanvas.hidden = false;
    networkCanvas.hidden = false;
    
    saveButton.hidden = false;
    discardButton.hidden = false;
    pauseButton.hidden = false;
    resumeButton.hidden = false;
    networkButton.hidden = false;
    
    N = carAmount.value;
    mutationAmt = mutAmount.value; // default is 0.1

    animate();
    startTime = performance.now() - elapsed; // continue from any previous elapsed
    timerId = setInterval(updateClock, 250);
    startButton.hidden = true;
}

function save(){
    localStorage.setItem("bestBrain",
        JSON.stringify(bestCar.brain));
}

function discard(){
    localStorage.removeItem("bestBrain");
}

function pause(){
    // clock
    clearInterval(timerId);
    timerId = null;

    cancelAnimationFrame(animRequest);
    animRequest = null;
}

function resume(){
  // clock
  // prevents speeding up and running clock bugs when clicking resume multiple times
  if(!animRequest){
      startTime = performance.now() - elapsed; // keep elapsed time
      timerId = setInterval(updateClock, 250);

      animRequest = requestAnimationFrame(animate);
  }
}

function getRandomLane(){
  let randomLane = 0;
  randomLane = road.getLaneCenter(Math.floor(Math.random() * 3));
  return randomLane;
}

function generateCars(N){
  const cars=[];
  
  for(let i=1;i<=N;i++){
    let c = new Car(road.getLaneCenter(1),100,30,50,"AI");
    cars.push(c);
    

    heap.insert(i, -c.y);
  }
  return cars;
}

function animate(time){
  for(let i=0;i<traffic.length;i++){
    traffic[i].update(road.borders,[]);
  }
  for(let i=0;i<cars.length;i++){
    cars[i].update(road.borders,traffic);
  }

  bestCar=cars.find(
      c=>c.y==Math.min(
          ...cars.map(c=>c.y)
      ));

  carCanvas.height=window.innerHeight;
  networkCanvas.height=window.innerHeight;

  carCtx.save();
  carCtx.translate(0,-bestCar.y+carCanvas.height*0.7);

  road.draw(carCtx);
  for(let i=0;i<traffic.length;i++){
    if(traffic[i].y > bestCar.y + 213){
      traffic[i].x = getRandomLane();
      traffic[i].y -= 800; 
    }

    traffic[i].draw(carCtx);
  }
  carCtx.globalAlpha=0.2;
  for(let i=0;i<cars.length;i++){
    heap.update(i, -cars[i].y);

    cars[i].draw(carCtx);
  }
  updateTrackBestCar();
  carCtx.globalAlpha=1;

  bestCar.draw(carCtx,true);

  carCtx.restore();

  networkCtx.lineDashOffset=-time/50;
  Visualizer.drawNetwork(networkCtx,bestCar.brain);

  updateLeaderboard();
  updateRemainingCounter();

  animRequest = requestAnimationFrame(animate);
}




// clock
let startTime = 0;  // timestamp when the timer started
let elapsed = 0;    // total elapsed
let timerId = null; // setInterval id for the clock display


const hrsEl = document.getElementById('hours');
const minsEl = document.getElementById('minutes');
const secsEl = document.getElementById('seconds');


function pad(num, digits = 2) {
  return String(num).padStart(digits, '0');
}

function updateClock() {
  const now = performance.now();
  elapsed = now - startTime;

  const totalSec = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  hrsEl.textContent = pad(hours);
  minsEl.textContent = pad(minutes);
  secsEl.textContent = pad(seconds);
}


// leaderboard
function updateLeaderboard() {
  // top 5 cars with the highest y (closest to top)
  const top = heap.topK(5);
  // sort descending for display
  top.sort((a, b) => b.y - a.y);

  // rebuild list
  leaderboard.innerHTML = '';
  top.forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `#${entry.id}    Traveled: ${Math.round(entry.y)}`;
      leaderboard.appendChild(li);
  });
}


// remaining number of cars
const counterDisplay   = document.getElementById('counterDisplay');

function updateRemainingCounter() {
  let alive = cars.length;
  for (const c of cars) {
    if (c.damaged) alive--;
  }
  const total = cars.length;
  counterDisplay.textContent = `${alive} / ${total}`;
}



function updateTrackBestCar() {
  // heap stores key = -y, so the root has the *largest* key -> smallest y
  const root = heap.heap[0];  // {id, key}
  if (!root) return;          // safety

  const candidateId = root.id;
  const candidateY  = -root.key; // restore real y

  if (bestCarId === null) {
    bestCarId = candidateId; // first frame
    return;
  }

  // get the y of the currently tracked bestcar
  const currentY = cars[bestCarId].y;

  // replace only if the new particle is significantly lower
  if (candidateY < currentY - BESTCAR_TOLERANCE) {
    bestCarId = candidateId;
  }
}


// heap creation
function onHeapRootChange(newRootId) {
  bestCarId = newRootId;
}