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
                    outgoing: {
                        light: "#EEFFDE",
                        dark: "#2B5278",
                    },
                    incoming: {
                        light: "#FFFFFF",
                        dark: "#181818",
                    },
                },
            },
        },
    },
};

// Check for dark mode
if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark");
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (event.matches) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
});
