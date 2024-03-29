const userName = "Igor-"+Math.floor(Math.random() * 100000)
const password = 'x'
document.querySelector('#user-name').innerHTML = userName;
let didIOffer = false;

const socket =io.connect('wss://192.168.1.12:8181/', {
  auth: {
    userName, 
    password
  }
})
const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream; // a var to hold the local video stream
let remoteStream; //a var to hold the remote video stream
let peerConnection; //the peerConnection that the two client use to talk

let peerConfiguration = {
  iceServers:[
      {
          urls:[
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302'
          ]
      }
  ]
}

//when a client initiates a call

const call = async e => {
  
  await fetchUserMedia()
  //peerConnection is all set with our STUN server send over
  await createPeerConnection()

  //create offer time
  try{
    console.log("Creating offer")
    const offer = await peerConnection.createOffer()
    // console.log(offer)
    peerConnection.setLocalDescription(offer)
    didIOffer = true
    socket.emit('newOffer', offer) //send offer to signalingServer
  }catch(err){
    console.log(err)
  }

}
const answerOffer = async (offerObj) => {
  await fetchUserMedia()
  await createPeerConnection(offerObj)
  const answer = await peerConnection.createAnswer({})
  await peerConnection.setLocalDescription(answer); //this is client2, and CLIENT2 uses the answer as the localDescription
  console.log(offerObj)
  console.log(answer)
  // console.log(peerConnection.signalingState) //should be have-local-pranswer because CLINT2 has set its local desc to it's answer (but it won't be)
  //add the answer to eh offerObj so the server knows which offer this is related to
  offerObj.answer = answer
  //emit the answer to the signaling server, so it can emit to Client1
  //expect a response from the server with the already existing ICE candidate
  const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj)
  offerIceCandidates.forEach(c=>{
    peerConnection.addIceCandidate(c);
    console.log("======Added Ice Candidate======")
  })
  console.log(offerIceCandidates)
}
const addAnswer = async (offerObj)=>{
  //addAnswer is called in socketListeners when an answerResponse is emitted.
  //at this point, the offer and answer have been exchanged!
  //now CLINT1 needs to set the remote
  await peerConnection.setRemoteDescription(offerObj.answer)
  // console.log(peerConnection.signalingState)

}
const fetchUserMedia = () => {
  return new Promise(async(resolve, reject)=> {
    try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })
    localVideoEl.srcObject = stream;
    localStream = stream;
    resolve()
  }catch(err){
    console.log(err)
    reject()
  }
  })
}
const createPeerConnection = (offerObj) => {
  return new Promise(async(resolve, reject)=> {
    //RTCPeerConnection is the things that creates the connection
    //we can pass a config object, and that config object can contain stun servers
    //with will fetch us ICE candidates
    peerConnection = await new RTCPeerConnection(peerConfiguration)
    remoteStream = new MediaStream()
    remoteVideoEl.srcObject = remoteStream;
    
    
    
    localStream.getTracks().forEach(track=>{
      //add localTracks so that they can be set once the connection is established
      peerConnection.addTrack(track, localStream);
    })

    peerConnection.addEventListener("signalingstatechange", (event) => {
      console.log(event) 
      // console.log(peerConnection.signalingState)
    })
    peerConnection.addEventListener('icecandidate', e=>{
      console.log('...Ice candidate found!.....')
      // console.log(e)
      if(e.candidate){
        socket.emit('sendIceCandidateToSignalingServer', {
          iceCandidate: e.candidate,
          iceUserName: userName,
          didIOffer,
        })
      }
      
    })

    peerConnection.addEventListener('track', e=>{
      console.log("Got a track from the other peer!")
      console.log(e)
      e.streams[0].getTracks().forEach(track=>{
        remoteStream.addTrack(track, remoteStream)
        console.log("Here")
      })
    })

    if(offerObj){
      //this won't be set when called from call()
      //will be set when we call from answerOffer()
      // console.log(peerConnection.signalingState)
      await peerConnection.setRemoteDescription(offerObj.offer)
      // console.log(peerConnection.signalingState)//should be have-remote-offer, because client2 has setRemoteDesc on the offer
    }
    resolve()
  })
  
}
const addNewIceCandidate = iceCandidate=> {
  peerConnection.addIceCandidate(iceCandidate)
  console.log("======Added Ice Candidate======")
}

document.querySelector('#call').addEventListener('click', call)