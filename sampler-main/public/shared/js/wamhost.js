
let mount;
let audioContext;

console.log("wamhost.js loaded");
window.addEventListener("load", loadWAM);

async function loadWAM() {
    console.log("page loaded");
    // execute after the page is loaded
    mount = document.querySelector('#wamsampler-container');
    audioContext = new AudioContext();

    // Init the WAM host
    const { default: initializeWamHost } = await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
    const [hostGroupId] = await initializeWamHost(audioContext);

    // Import the WAM sampler plugin
    const { default: WAM } = await import('https://mainline.i3s.unice.fr/WamSampler/src/index.js');

    // Create a new instance of the plugin
    const instance = await WAM.createInstance(hostGroupId, audioContext);
    
    // Connect the audionode of the plugin to the Web audio graph
    connectPlugin(instance.audioNode);

    // Create the GUI of the plugin and display it in the page
    const pluginDomNode = await instance.createGui();
    mountPlugin(pluginDomNode);
}

// Very simple function to connect the plugin audionode to the speakers
const connectPlugin = (audioNode) => {
    audioNode.connect(audioContext.destination);
};

const mountPlugin = (domNode) => {
    // Basic way to mount a DOM node in a Html element
    // We first clear the mount element, then we add the domNode
    mount.innerHtml = '';
    mount.appendChild(domNode);
};

