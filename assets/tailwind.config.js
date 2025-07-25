tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#5D5CDE",
                light: "#FFF",
                dark: "#212121",
                secondaryLight: "#F5F5F5",
                secondaryDark: "#181818",
                accent: "#5D5CDE",
                accentHover: "#4A49B8",
                chatBg: {
                    light: "#FFFFFF",
                    dark: "#0F0F0F",
                },
                messageBg: {
                    light: "#FFFFFF",
                    dark: "#212121",
                },
            },
        },
    },
};

// Check for dark mode
if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark");
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = `manifest-dark.json`;
    document.head.appendChild(manifest);
}
// Watch for dark mode
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (event.matches) {
        document.documentElement.classList.add("dark");
        const manifest = document.createElement('link');
        manifest.rel = 'manifest';
        manifest.href = `manifest-dark.json`;
        document.head.appendChild(manifest);
    } else {
        document.documentElement.classList.remove("dark");
        const manifest = document.createElement('link');
        manifest.rel = 'manifest';
        manifest.href = `manifest.json`;
        document.head.appendChild(manifest);
    }
});
