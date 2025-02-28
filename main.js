const { Plugin, normalizePath, PluginSettingTab, Setting } = require('obsidian');

module.exports = class GenreSyncPlugin extends Plugin {
    async onload() {
        console.log("Loading GenreSyncPlugin...");
        
        this.settings = await this.loadSettings();
        this.addSettingTab(new GenreSyncSettingTab(this.app, this));
        
        this.addCommand({
            id: "update-genre-pages",
            name: "Update Genre Pages",
            callback: async () => await this.updateGenrePages(),
        });

        console.log("GenreSyncPlugin loaded successfully.");
    }

    async updateGenrePages() {
        console.log("Updating genre pages...");
        
        if (!this.settings.artistFolder || !this.settings.genreFolder) {
            console.warn("Artist and genre folders must be set in the settings before running the command.");
            return;
        }

        const artistFolder = normalizePath(this.settings.artistFolder);
        const genreFolder = normalizePath(this.settings.genreFolder);
        const vault = this.app.vault;
        const metadataCache = this.app.metadataCache;
        
        const artistFiles = vault.getMarkdownFiles().filter(file => file.path.startsWith(artistFolder));
        const genreFiles = vault.getMarkdownFiles().filter(file => file.path.startsWith(genreFolder));
        
        let genresSet = new Set();
        
        for (const file of artistFiles) {
            console.log(`Reading file: ${file.path}`);
            const fileCache = metadataCache.getFileCache(file);
            if (fileCache?.frontmatter && fileCache.frontmatter.genres) {
                const genreList = fileCache.frontmatter.genres;
                if (Array.isArray(genreList)) {
                    genreList.forEach(g => genresSet.add(g.toLowerCase().trim()));
                } else if (typeof genreList === 'string') {
                    genresSet.add(genreList.toLowerCase().trim());
                }
                console.log(`Extracted genres from ${file.path}:`, genreList);
            }
        }

        console.log("Final Extracted Genres:", [...genresSet]);

        const existingGenres = new Set(genreFiles.map(file => file.basename.toLowerCase()));
        console.log("Existing genres in folder:", [...existingGenres]);

        const missingGenres = [...genresSet].filter(g => !existingGenres.has(g));
        console.log("Missing genres to be created:", missingGenres);

        for (const genre of missingGenres) {
            const safeGenre = genre.replace(/[\\/:*?"<>|]/g, "_"); // Replace invalid filename characters
            const genreSlug = genre.replace(/\s+/g, '-').toLowerCase(); // For Chosic URL
            const genreNoSpecialChars = genre.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); // For EveryNoise URL
            
            const genrePath = `${genreFolder}/${safeGenre}.md`;
            const genreContent = `---\nchosicUrl: https://www.chosic.com/genre-chart/${genreSlug}/\neverynoiseUrl: https://everynoise.com/engenremap-${genreNoSpecialChars}.html\n---\n\n\`\`\`dataview\nlist\nfrom "${artistFolder}"\nwhere contains(genres, "${genre}")\n\`\`\``;
            await vault.create(genrePath, genreContent);
            console.log(`Created genre page: ${genrePath}`);
        }

        console.log("Genre pages updated successfully.");
    }

    async loadSettings() {
        let settings = await this.loadData() || {};
        return settings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
};

class GenreSyncSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        let { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Artist Folder")
            .setDesc("Folder where artist markdown files are stored.")
            .addText(text => text.setValue(this.plugin.settings.artistFolder || "")
                .onChange(async (value) => {
                    this.plugin.settings.artistFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Genre Folder")
            .setDesc("Folder where genre markdown files should be created.")
            .addText(text => text.setValue(this.plugin.settings.genreFolder || "")
                .onChange(async (value) => {
                    this.plugin.settings.genreFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
