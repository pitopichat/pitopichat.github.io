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
                animation: {
                'float': 'float 6s ease-in-out infinite',
                'float-delayed': 'float 6s ease-in-out infinite 2s',
                'plane-fly': 'plane-fly 8s ease-in-out infinite',
            },
            keyframes: {
                float: {
                '0%, 100%': { transform: 'translateY(0px)' },
                '50%': { transform: 'translateY(-20px)' },
                },
                'plane-fly': {
                '0%': { transform: 'translateX(-50px) translateY(10px) rotate(-5deg)' },
                '50%': { transform: 'translateX(20px) translateY(-30px) rotate(5deg)' },
                '100%': { transform: 'translateX(-50px) translateY(10px) rotate(-5deg)' },
                }
            }
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
