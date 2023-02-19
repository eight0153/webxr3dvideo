// @ts-ignore
import * as THREE from 'three'
// @ts-ignore
import {TrackballControls} from 'three/examples/jsm/controls/TrackballControls.js'
// @ts-ignore
import Stats from "three/examples/jsm/libs/stats.module.js"
// @ts-ignore
import {VRButton} from 'three/examples/jsm/webxr/VRButton.js'
// @ts-ignore
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'

window.onload = () => {
    init()
}

class MeshVideo {
    private readonly videoBaseFolder: string
    private readonly sceneName: string
    private loader: GLTFLoader

    private readonly frames: { number: THREE.Mesh }
    private readonly useVertexColour: boolean
    private readonly persistFrame: boolean
    private readonly swapMeshInterval: number
    private timeSinceLastMeshSwap: number
    // The current frame position in the video sequence.
    private currentFrameIndex: number
    // The index of the currently displayed frame (null if no frame is currently displayed).
    private displayedFrameIndex: number

    // Whether the mesh has a single frame and has `persistFrame` set to `true`.
    private isStaticMesh: boolean

    public numFrames: number
    public hasLoaded: boolean

    constructor({
                    swapMeshInterval,
                    loader,
                    videoBaseFolder,
                    sceneName = 'scene3d',
                    useVertexColour = false,
                    persistFrame = false
                }) {
        this.videoBaseFolder = videoBaseFolder
        this.sceneName = sceneName
        this.loader = loader

        // @ts-ignore
        this.frames = {}
        this.useVertexColour = useVertexColour
        this.persistFrame = persistFrame
        this.swapMeshInterval = swapMeshInterval
        this.isStaticMesh = false
        this.reset()

        this.numFrames = 0
        this.hasLoaded = false
    }

    // Go to the start of the video sequence.
    reset() {
        this.currentFrameIndex = 0
        this.timeSinceLastMeshSwap = 0.0
        this.displayedFrameIndex = null
    }

    /**
     * Load the mesh data from disk.
     * @return A reference to this MeshVideo object.
     *  Allows a call to this load function to be chained when creating a new instance.
     */
    load(): MeshVideo {
        this.loader.load(
            `${this.videoBaseFolder}/${this.sceneName}.glb`,
            (gltf) => {
                console.debug(gltf)
                console.debug(gltf.scene.children[0].children as unknown as Array<THREE.Mesh>)

                for (const mesh of gltf.scene.children[0].children as unknown as Array<THREE.Mesh>) {
                    // Objects will either of type "Mesh" or "Object3D". The latter occurs when there is no mesh.
                    if (mesh.type == "Mesh") {
                        mesh.material = new THREE.MeshBasicMaterial({map: (mesh.material as THREE.MeshStandardMaterial).map})

                        if (this.useVertexColour) {
                            mesh.material.vertexColors = true
                        }

                        const frame_number = parseInt(mesh.name)
                        this.frames[frame_number] = mesh

                        if (this.currentFrameIndex < 0) {
                            this.currentFrameIndex = frame_number
                        }

                        if (frame_number > this.numFrames) {
                            this.numFrames = frame_number
                        }
                    }
                }

                this.hasLoaded = true

                const numFramesLoaded = Object.keys(this.frames).length

                if (numFramesLoaded === 1 && this.persistFrame) {
                    this.isStaticMesh = true
                }

                console.info(`Loaded ${numFramesLoaded} frames for video "${this.sceneName}" in ${this.videoBaseFolder}.`)
            },
            undefined,
            (error) => {
                console.error(error)
            }
        )

        return this
    }

    /**
     * Perform a frame update if enough time has elapsed since the last update.
     * @param delta The time since the last call to this method.
     * @param scene The scene object to display the mesh(es) in.
     */
    update(delta: number, scene: THREE.Scene | THREE.Group) {
        if (!this.hasLoaded) {
            return
        }

        this.timeSinceLastMeshSwap += delta

        if (this.timeSinceLastMeshSwap >= this.swapMeshInterval && this.numFrames > 0) {
            // The time since last mesh swap can be many multiples of the swap mesh interval if the renderer loses
            // focus and comes back into focus later.
            const framesSinceLastUpdate = Math.floor(this.timeSinceLastMeshSwap / this.swapMeshInterval)
            this.timeSinceLastMeshSwap = Math.max(0.0, this.timeSinceLastMeshSwap - framesSinceLastUpdate * this.swapMeshInterval)

            if (framesSinceLastUpdate > 1) {
                console.debug(`Catching up by skipping ${framesSinceLastUpdate - 1} frames...`)
            }

            this.step(scene, framesSinceLastUpdate)
        }
    }

    /**
     * Advance some number of frames.
     * @param scene The scene object to update.
     * @param times How many frames to step through (default=1).
     * @private
     */
    private step(scene: THREE.Scene | THREE.Group, times=1) {
        const previousFrameIndex = this.displayedFrameIndex
        const nextFrameIndex = (this.currentFrameIndex + times) % this.numFrames

        if (this.isStaticMesh && this.displayedFrameIndex === null) {
            const index = parseInt(Object.keys(this.frames)[0])
            scene.add(this.frames[index])
            this.displayedFrameIndex = index
        } else {
            const hasPreviousFrame = this.frames.hasOwnProperty(previousFrameIndex)
            const hasNextFrame = this.frames.hasOwnProperty(nextFrameIndex)

            const shouldUpdateFrame = (this.persistFrame && hasNextFrame) || !this.persistFrame

            if (shouldUpdateFrame) {
                if (hasPreviousFrame) {
                    scene.remove(this.frames[previousFrameIndex])
                }

                if (hasNextFrame) {
                    scene.add(this.frames[nextFrameIndex])
                    this.displayedFrameIndex = nextFrameIndex
                }
            }
        }

        this.currentFrameIndex = nextFrameIndex
    }
}

class LoadingOverlay {
    private readonly loaderGUI: HTMLElement
    private readonly rendererGUI: HTMLElement
    isVisible: boolean

    constructor() {
        this.loaderGUI = document.getElementById("loader-overlay")
        this.rendererGUI = document.getElementById("container")
        this.isVisible = false
    }

    show() {
        this.loaderGUI.style.display = 'block'
        this.rendererGUI.style.display = 'none'
        this.isVisible = true
    }

    hide() {
        this.loaderGUI.style.display = 'none'
        this.rendererGUI.style.display = 'block'
        this.isVisible = false
    }

}

const createRenderer = (width: number, height: number): THREE.WebGLRenderer => {
    const renderer = new THREE.WebGLRenderer()
    renderer.setSize(width, height)
    document.body.appendChild(renderer.domElement)

    renderer.setClearColor(0x000000, 1)

    return renderer
}

const createControls = (camera: THREE.Camera, renderer: THREE.WebGLRenderer): TrackballControls => {
    const controls = new TrackballControls(camera, renderer.domElement)

    controls.rotateSpeed = 1.0
    controls.zoomSpeed = 1.0
    controls.panSpeed = 0.8

    return controls
}

const createStatsPanel = (): Stats => {
    const stats = Stats()
    stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom)

    return stats
}

const getVideoFolder = (): string => {
    const queryString = window.location.search
    const urlParams = new URLSearchParams(queryString)
    let videoFolder: string

    if (urlParams.has('video')) {
        videoFolder = urlParams.get('video')
    } else {
        videoFolder = 'demo'
    }

    return videoFolder
}

async function loadMetadata(videoFolder: string) {
    const response = await fetch(`${videoFolder}/metadata.json`)
    return await response.json()
}

const getGroundPlane = (width: number = 1, height: number = 1, color: number = 0xffffff): THREE.Mesh => {
    return new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({color: color, side: THREE.DoubleSide})
    ).rotateX(-Math.PI / 2)
}

const loadSkybox = (): THREE.CubeTexture => {
    return new THREE.CubeTextureLoader()
        .setPath('cubemaps/sky/')
        .load([
            'pos_x.jpg',
            'neg_x.jpg',
            'pos_y.jpg',
            'neg_y.jpg',
            'pos_z.jpg',
            'neg_z.jpg',
        ])
}

const saveJSON = (content, fileName, contentType = 'text/plain') => {
    var a = document.createElement("a");
    var file = new Blob([JSON.stringify(content)], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

interface Vector3 {x: number, y: number, z: number}
interface Vector4 {x: number, y: number, z: number, w: number}
interface Pose {position: Vector3, rotation: Vector4}

const getPoseFromCamera = (camera): Pose => {
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const matrixWorld = camera.matrixWorld

    position.setFromMatrixPosition(matrixWorld)
    rotation.setFromRotationMatrix(matrixWorld)

    return {
        'position': {
            'x': position.x,
            'y': position.y,
            'z': position.z
        },
        'rotation': {
            'x': rotation.x,
            'y': rotation.y,
            'z': rotation.z,
            'w': rotation.w
        }
    }
}

const updateMetadata = (camera, renderer, metadata) => {
    let newMetadata = {...metadata}

    newMetadata.pose = getPoseFromCamera(camera)

    console.debug(`Camera Pose: ${JSON.stringify(newMetadata.pose)}`)

    if (renderer.xr.isPresenting) {
        const headsetCamera = renderer.xr.getCamera()
        newMetadata.headsetPose = getPoseFromCamera(headsetCamera)

        console.debug(`Headset Pose: ${JSON.stringify(newMetadata.headsetPose)}`)
    }

    saveJSON(newMetadata, 'metadata.json' )
}

const applyPose = (object, pose: Pose, inverse=false) => {
    const position = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z)
    const rotation = new THREE.Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w)

    if (inverse) {
        object.quaternion.multiply(rotation.conjugate())
        object.position.add(position.negate())
    } else {
        object.position.add(position)
        object.quaternion.multiply(rotation)
    }
}

function init() {
    const canvasWidth = window.innerWidth
    const canvasHeight = window.innerHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, canvasWidth / canvasHeight, 0.1, 1000)
    const renderer = createRenderer(canvasWidth, canvasHeight)
    const controls = createControls(camera, renderer)
    const stats = createStatsPanel()
    const userGroup = new THREE.Group()
    const keys = {
        'r': 82,
        'p': 80
    }

    const videoFolder = getVideoFolder()
    document.title = `3D Video | ${videoFolder}`

    const loadingOverlay = new LoadingOverlay()
    loadingOverlay.show()

    loadMetadata(videoFolder).then(metadata => {
        const resetCamera = () => {
            controls.reset()

            camera.position.set(0.0, 0.0, 0.0)
            camera.quaternion.set(0.0, 0.0, 0.0, 1.0)

            camera.position.setZ(-1.5)
            camera.lookAt(0, 0, 0)

            // if (metadata.hasOwnProperty('pose')) {
            //     const pose = metadata.pose
            //     console.debug(`Using initial pose from metadata: ${JSON.stringify(pose)}`)
            //
            //     applyPose(camera, pose)
            // } else {
            //     camera.position.setZ(-1.5)
            //     camera.lookAt(0, 0, 0)
            // }

            // Have to move the world instead of the camera to get the controls to behave correctly...
            scene.position.setY(-1.5)
        }

        const onDocumentKeyDown = (event) => {
            const keyCode = event.which

            switch (keyCode) {
                case keys.r: {
                    resetCamera()
                    break
                }
                case keys.p: {
                    updateMetadata(camera, renderer, metadata)
                    break
                }
                default:
                    console.debug(`Key ${keyCode} pressed.`)
            }
        }
        document.addEventListener("keydown", onDocumentKeyDown, false);

        const loader = new GLTFLoader()
        const swapMeshInterval = 1.0 / metadata["fps"] // seconds

        const dynamicElements = new MeshVideo({
            swapMeshInterval,
            loader,
            videoBaseFolder: videoFolder,
            sceneName: "fg",
            useVertexColour: false,
            persistFrame: false
        }).load()

        const staticElements = new MeshVideo({
            swapMeshInterval,
            loader,
            videoBaseFolder: videoFolder,
            sceneName: 'bg',
            useVertexColour: metadata["use_vertex_colour_for_bg"],
            persistFrame: true
        }).load()

        if (metadata.hasOwnProperty("add_ground_plane") && metadata["add_ground_plane"] === true) {
            scene.add(getGroundPlane(100, 100))
        }

        if (metadata.hasOwnProperty("add_sky_box") && metadata["add_sky_box"] === true) {
            scene.background = loadSkybox()
        }

        const clock = new THREE.Clock()

        // we add an ambient light source to the scene
        scene.add(new THREE.AmbientLight(0xffffff));

        const onSceneLoaded = () => {
            // Ensure that the two clips will be synced
            const numFrames = metadata["num_frames"] ?? Math.max(staticElements.numFrames, dynamicElements.numFrames)
            dynamicElements.numFrames = numFrames
            staticElements.numFrames = numFrames

            dynamicElements.reset()
            staticElements.reset()

            resetCamera()

            renderer.xr.enabled = true
            renderer.xr.setReferenceSpaceType('local')
            document.body.appendChild(VRButton.createButton(renderer))

            loadingOverlay.hide()

            clock.start()
        }

        scene.add(userGroup)

        // Have to use `xr` as type any as a workaround for no property error for `addEventListener` on `renderer.xr`.
        const xr: any = renderer.xr
        let headsetCamera = null

        xr.addEventListener('sessionstart', () => {
            // since we move the scene to be "centered" on the trackball controller,
            // we need to move the controllers to match the new scene location
            userGroup.position.set(0.0, 0.0, 0.0)
            userGroup.rotation.set(0.0, 0.0, 0.0)

            userGroup.translateY(1.5)
            userGroup.add(camera)
            userGroup.translateZ(-1.5)
            userGroup.rotateY(Math.PI)

            if (metadata.hasOwnProperty('headsetPose')) {
                console.debug(`Initialising headset with pose: ${JSON.stringify(metadata.headsetPose)}`)
                headsetCamera = renderer.xr.getCamera()
                // userGroup.add(headsetCamera)
                applyPose(userGroup, metadata.headsetPose, true)
            } else {
            }

            console.debug("Entered XR mode.")
        })

        xr.addEventListener('sessionend', () => {
            if (metadata.hasOwnProperty('headsetPose')) {
                applyPose(userGroup, metadata.headsetPose)
                // userGroup.remove(headsetCamera)
            } else {
            }

            userGroup.rotateY(Math.PI)
            userGroup.translateZ(1.5)
            userGroup.remove(camera)
            userGroup.translateY(-1.5)

            userGroup.rotation.set(0.0, 0.0, 0.0)
            userGroup.position.set(0.0, 0.0, 0.0)

            resetCamera()

            console.debug("Exited XR mode.")
        })

        renderer.setAnimationLoop(() => {
            stats.begin()

            if (loadingOverlay.isVisible && dynamicElements.hasLoaded && staticElements.hasLoaded) {
                onSceneLoaded()
            }

            const delta = clock.getDelta()

            dynamicElements.update(delta, userGroup)
            staticElements.update(delta, userGroup)
            controls.update()

            renderer.render(scene, camera)

            stats.end()
        })
    })
        .catch(() => alert("An error occurred when trying to load the video."))
}
