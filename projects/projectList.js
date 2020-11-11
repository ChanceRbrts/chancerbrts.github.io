
let createProjects = async() => {
    let test = await fetch("https://chancerbrts.github.io/projects/lists/testList.json")
    test.json().then(d => createIcons(d));
}

var json = "[]";

// Should be an array of different projects.
let data = JSON.parse(json);

let createIcons = (data) => {
    let sideBySideDiv = undefined;


    for (i = 0; i < data.length; i++){
        if (i%2 == 0){
            sideBySideDiv = document.createElement("div");
            sideBySideDiv.style.overflow = "auto";
        }
        let fullDiv = document.createElement("div");
        fullDiv.style.cssText =  `float: ${i%2 == 0? "left" : "right"}; width: 49%`;
        if (i%2 == 1) fullDiv.style.paddingRight = "8px";
        let div = document.createElement("div");
        let contentDiv = document.createElement("div");
        // Each project takes of half of the screen.
        // Two projects are side by side
        div.style.cssText = "width: 100%;";
        div.onmouseover = () => mouseOverDiv(div, contentDiv);
        div.onmouseout = () => mouseOutDiv(div, contentDiv);
        div.onmousedown = () => mouseDownDiv(div, contentDiv);
        // This is where the text pane is.
        let leftDiv = document.createElement("div");
        leftDiv.style.cssText = "float: left;";
        div.className = "projectBox";
        div.style.backgroundColor = "#a0a0a0ee";
        div.style.margin = "4px";
        div.style.marginTop = "12px";
        div.style.marginBottom = "0px";
        // The title of the project is here.
        let title = document.createElement("b");
        title.innerText = data[i].title;
        title.style.cssText = "font-size: 32px; margin-left: 4px;";
        leftDiv.appendChild(title);
        let smallDesc = document.createElement("div");
        // A small summary of the project is below the title.
        smallDesc.innerText = data[i].smallDesc;
        smallDesc.style.cssText = "font-size: 18px; color: #222222; padding-top: 10px; margin-left: 4px;";
        leftDiv.appendChild(smallDesc);
        // The technology used in the project is below the title.
        let techUsed = document.createElement("div");
        techUsed.innerText = "Technology Used: ";
        techUsed.style.cssText = "font-size: 18px; color: #222222; margin-left: 4px;";
        // The technologies that were used will be indented.
        let indent = document.createElement("i");
        indent.innerText = data[i].tech;
        indent.style.cssText = "color: #444444";
        techUsed.appendChild(indent);
        leftDiv.appendChild(techUsed);
        div.appendChild(leftDiv);
        // The image of the project is put on the right hand side of the project bar.
        let image = document.createElement("img");
        image.src = `images/${data[i].image}`;
        image.style.cssText = "float:right; width:100px; vertical-align:middle; padding:4px;";
        div.appendChild(image);
        // Resetting float here.
        let endDiv = document.createElement("div");
        endDiv.style.cssText = "clear:right;";
        div.appendChild(endDiv);
        // The full summary and project link go into a collapsable div.
        contentDiv.style.cssText = "width: 100%; margin: 4px; margin-top: 0px; padding-top: 4px; font-size: 18px"
        contentDiv.style.backgroundColor = "#ddddddee";
        contentDiv.style.overflow = "hidden";
        // This is actual HTML, but since I'm in charge of what's in this area and not the user, XSS is not an issue.
        contentDiv.innerHTML = data[i].summary;
        contentDiv.style.maxHeight = "0px";
        contentDiv.style.transition = "max-height 0.5s";
        // If there is a link to the project somewhere, put it here.
        if (data[i].link && data[i].link.length > 0){
            contentDiv.innerHTML += "</br>";
            let projectLink = document.createElement("a");
            projectLink.innerHTML = "Project Link";
            projectLink.href = data[i].link;
            contentDiv.appendChild(projectLink);
        }
        // If there is a demo of the project somewhere, put it here.
        if (data[i].demo && data[i].demo.length > 0){
            contentDiv.innerHTML += "</br>";
            let tryItOut = document.createElement("a");
            tryItOut.innerHTML = "Try It Out!";
            tryItOut.href = data[i].demo;
            contentDiv.appendChild(tryItOut);
        }
        fullDiv.appendChild(div);
        fullDiv.appendChild(contentDiv);
        sideBySideDiv.appendChild(fullDiv);
        if (i%2 == 1 || i == data.length-1){
            let finalDiv = document.createElement("div");
            finalDiv.style.cssText = "clear: right; clear: left;";
            sideBySideDiv.appendChild(finalDiv);
            document.body.appendChild(sideBySideDiv);
        }
        // document.body.appendChild(fullDiv);
    }
}

let mouseOverDiv = (div, contentDiv) => {
    div.style.borderRadius = "2px";
    div.style.borderColor = "#648dbd88";
    div.style.borderWidth = "4px";
    div.style.borderStyle = "solid";
    div.style.margin = "0px";
    div.style.marginTop = "8px";
    contentDiv.style.paddingTop = "0px";
};

let mouseOutDiv = (div, contentDiv) => {
    div.style.borderWidth = "0px";
    div.style.borderRadius = "0px";
    div.style.margin = "4px";
    div.style.marginBottom = "0px";
    div.style.marginTop = "12px";
    contentDiv.style.paddingTop = "4px";
}

let mouseDownDiv = (mainDiv, contentDiv) => {
    if (contentDiv.style.maxHeight == `${contentDiv.scrollHeight}px`){
        contentDiv.style.maxHeight = "0px";
    } else contentDiv.style.maxHeight = `${contentDiv.scrollHeight}px`;
}

createProjects();
