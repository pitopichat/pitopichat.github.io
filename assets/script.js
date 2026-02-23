const cursor = document.getElementById("cursor");
const ring = document.getElementById("cursorRing");
let mx = 0,
    my = 0,
    rx = 0,
    ry = 0;

document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    cursor.style.left = mx - 4 + "px";
    cursor.style.top = my - 4 + "px";
});

function animateRing() {
    rx += (mx - rx - 16) * 0.12;
    ry += (my - ry - 16) * 0.12;
    ring.style.left = rx + "px";
    ring.style.top = ry + "px";
    requestAnimationFrame(animateRing);
}
animateRing();