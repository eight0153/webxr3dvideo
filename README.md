# WebXR 3D Video
## Getting Started
```shell
# 1) Clone repo
git clone https://github.com/eight0153/webxr3dvideo
cd webxr3dvideo
# 2) Setup dev environment via either:
# 2a) local dev environment
npm install
npm run start
# OR 
# 2b) docker dev environment
docker build -t node-16:latest .
docker run --rm -p 8080:8080 -v $(pwd)/src:/app/src:ro -v $(pwd)/docs:/app/docs --name node-16 node-16:latest 
```
The dev server will be accessible via http://localhost:8080.
The web page works best with the Mozilla Firefox web browser.
## Updating the GitHub Page
1. Run the following commands after updating the page on the main branch.
    ```shell
   # If you are running the local dev environment
    npm run build
   # OR if you are running the docker dev environment
   docker run --rm -v $(pwd)/src:/app/src:ro -v $(pwd)/docs:/app/docs node-16:latest build
    # Add the new javascript files
    git add docs/index* 
    # (Optional) if you added video
    git add docs/video/*
    git commit -m "Your commit message here"
    git push
    ```
2. Reload \<GitHub Username>.github.io/\<Repository name> and it should show the updated contents.

## Known Issues
* Video textures do not update in Google Chrome when source videos are not visible.
* The web page will not load on Safari 15 (M1 Mac, macOS 12.6).
* Videos can desync when loading the hosted version of the web page, causing serious artefacts.