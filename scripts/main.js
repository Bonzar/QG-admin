var myPicture = document.querySelector('picture');
var myPicSourcesPortaint = myPicture.querySelector('source[media="(max-width: 768px)"]');
var myPicSourcesLandscape = myPicture.querySelector('source[media="(min-width: 769px)"]');
var myImage = myPicture.querySelector('img');

myImage.onclick = function () {
    var mySrc = myPicSourcesLandscape.getAttribute('srcset');
    if(mySrc === 'images/vlad-wide-landscape.jpeg') {
        myPicSourcesPortaint.setAttribute('srcset', 'images/Oddi-close-portrait.jpeg');
        myPicSourcesLandscape.setAttribute('srcset', 'images/Oddi-wide-landscape.jpeg');
        myImage.setAttribute('src', 'images/Oddi-wide-landscape.jpeg');

    } else {
        myPicSourcesPortaint.setAttribute('srcset', 'images/vlad-close-portrait.jpeg');
        myPicSourcesLandscape.setAttribute('srcset', 'images/vlad-wide-landscape.jpeg');
        myImage.setAttribute('src', 'images/vlad-wide-landscape.jpeg');
    }
}
var myButton = document.querySelector('button');
var myHeading = document.querySelector('h1');

function setUserName() {
    var myName = prompt('Please enter your name.');
    localStorage.setItem('name', myName);
    myHeading.textContent = 'Mozilla is cool, ' + myName;
}

if(!localStorage.getItem('name')) {
    setUserName();
} else {
    var storedName = localStorage.getItem('name');
    myHeading.textContent = 'Mozilla is cool, ' + storedName;
}

myButton.onclick = function () {
    setUserName();
}

