
function createModal() {
    return new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.style = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        const content = document.createElement("div");
        content.style = `
            background: black;
            padding: 20px 30px;
            border-radius: 10px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            text-align: center;
            font-family: sans-serif;
        `;
        content.innerHTML = `
            <h3 style="margin-top: 0;">Enter Raider.IO Access Key</h3>
            <p style="font-size: 14px;">
                To increase rate-limits and unlock world ranks,<br>
                create an application at:<br>
                <a href="https://raider.io/settings/apps" target="_blank" style="color: #0077cc;">https://raider.io/settings/api</a>
            </p>
            <p style="font-size: 14px;">
                You can skip this, and use the extension but it will work significantly slower
            </p>
            <input type="text" id="raiderioKeyInput" placeholder="Copy API Key and paste it here"
                style="width: 100%; padding: 8px; margin-top: 10px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px;">
            <br><br>
            <button id="raiderioSaveBtn"
                style="padding: 8px 16px; background-color: #0077cc; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer;">
                Save
            </button>
                        <button id="raiderioCancelBtn"
                style="padding: 8px 16px; background-color:rgb(204, 37, 0); color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer;">
                Don't ask again
            </button>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        const saveBtn = document.getElementById("raiderioSaveBtn");
        saveBtn.addEventListener("click", () => {
            const input = document.getElementById("raiderioKeyInput");
            const value = input.value.trim();

            if (value) {
                chrome.storage.local.set({ raiderio_access_key: value }, () => {
                    console.log("API Key stored correctly.");
                    document.body.removeChild(modal);
                    resolve(value);
                });
            }
        });
        const cancelBtn = document.getElementById("raiderioCancelBtn");
        cancelBtn.addEventListener("click", () => {
            chrome.storage.local.set({ raiderio_access_key: 'Empty' }, () => {
                document.body.removeChild(modal);
                resolve(value);
            });
        });
    });
}

async function getAccessKey() {
    const storedKey = await new Promise((resolve) => {
        chrome.storage.local.get("raiderio_access_key", (result) => {
            resolve(result.raiderio_access_key);
        });
    });
    if (storedKey === 'Empty') return;
    if (storedKey) return storedKey;

    return createModal();
}

async function extractGuildData() {
    const playersElements = document.querySelectorAll(".players-table-name-guild-realm");
    if (playersElements.length === 0) {
        setTimeout(extractGuildData, 5000);
        return;
    }
    const url = window.location.href;
    const raidIdMatch = url.match(/\/zone\/rankings\/(\d+)/);
    const raidId = raidIdMatch ? raidIdMatch[1] : null;
    if (raidId == null) {
        setTimeout(extractGuildData, 5000);
        return;
    }
    var raid = "";
    if (raidId == 38) {
        raid = "nerubar-palace";
    } else if (raidId == 40) {
        raid = "blackrock-depths";
    } else if (raidId == 42) {
        raid = "liberation-of-undermine";
    } else {
        setTimeout(extractGuildData, 5000);
        return;
    }

    const promises = [];
    for (const element of playersElements) {
        const guildElement = element.querySelector(".players-table-guild");
        const realmElement = element.querySelector(".players-table-realm");
        const playerElement = element.querySelector(".players-table-name");
        const printElement = element.querySelector(".players-table-guild-and-realm");

        const guild = guildElement ? guildElement.textContent.trim() : null;
        if (guild == null) continue;

        const player = playerElement ? playerElement.textContent.trim() : null;
        var realm = realmElement ? realmElement.textContent.trim() : null;
        const regionMatch = realm ? realm.match(/\(([^)]+)\)/) : null;
        const region = regionMatch ? regionMatch[1] : null;
        if (region === 'CN') continue;

        if (!guild || !realm || !region || !raid || !player)
            continue;

        realm = realm.split(' (')[0];

        const guildRealm = await checkGuildServer(player, realm, region);
        if (guildRealm)
            promises.push(checkCacheOrCallRaiderio(guild, guildRealm, region, raid, printElement));
    }
    await Promise.all(promises);
}

async function checkGuildServer(player, realm, region) {
    try {
        const baseUrl = "https://raider.io/api/v1/characters/profile";
        const regionParam = region.toLowerCase();
        const realmParam = encodeURIComponent(realm.toLowerCase().replace("'", ""));
        const playerParam = player.toLowerCase().replace(" ", "-");
        const accessKey = await getAccessKey();
        const url = `${baseUrl}?region=${regionParam}&realm=${realmParam}&name=${playerParam}&fields=guild${accessKey !== 'Empty' ? `&access_key=${accessKey}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        return data["guild"]?.["realm"];
    } catch (error) {
    }
}

async function checkCacheOrCallRaiderio(guild, realm, region, raid, guildElement) {
    const cache = JSON.parse(localStorage.getItem('guildDataCache')) || {};
    if (cache[region] && cache[region][realm] && cache[region][realm][guild] && cache[region][realm][guild][raid]) {
        addWRToElement(cache[region][realm][guild][raid], guildElement);
    } else {
        await callWorldRankRaiderIO(guild, realm, region, raid, guildElement);
    }
}

async function callWorldRankRaiderIO(guild, realm, region, raid, guildElement) {
    try {
        const baseUrl = "https://raider.io/api/v1/guilds/profile";
        const regionParam = region.toLowerCase();
        const realmParam = realm.toLowerCase().replace(" ", "-").replace("'", "");
        const guildParam = encodeURIComponent(guild.toLowerCase());
        const raidParam = raid.toLowerCase().replace(" ", "-");
        const accessKey = await getAccessKey();

        const url = `${baseUrl}?region=${regionParam}&realm=${realmParam}&name=${guildParam}&fields=raid_rankings:${raidParam}${accessKey !== 'Empty' ? `&access_key=${accessKey}` : ''}`;

        const response = await fetch(url);
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        const mythicWorldRanking = data?.raid_rankings?.[raid]?.mythic?.world;
        if (mythicWorldRanking) {
            saveToCache(region, realm, guild, raid, mythicWorldRanking);
            addWRToElement(mythicWorldRanking, guildElement);
        }

    } catch (error) {
    }
}

async function addWRToElement(mythicWorldRanking, guildElement) {
    if (mythicWorldRanking) {
        if (guildElement) {
            guildElement.insertAdjacentText('afterbegin', `WR: ${mythicWorldRanking}`);
        }
    }
}

async function saveToCache(region, realm, guild, raid, mythicWorldRanking) {
    let cache = JSON.parse(localStorage.getItem('warcraftLogsWRCache')) || {};
    if (!cache[region]) {
        cache[region] = {};
    }
    if (!cache[region][realm]) {
        cache[region][realm] = {};
    }
    if (!cache[region][realm][guild]) {
        cache[region][realm][guild] = {};
    }
    cache[region][realm][guild][raid] = mythicWorldRanking;
    localStorage.setItem('warcraftLogsWRCache', JSON.stringify(cache));
}

function observeTables() {
    const targetNode = document.body;
    const observer = new MutationObserver((mutationsList) => {
        mutationsList.forEach((mutation) => {
            if (mutation.type === "childList") {
                mutation.addedNodes.forEach((node) => {
                    if (
                        node.nodeType === 1 &&
                        node.tagName === "TABLE" &&
                        node.id.startsWith("DataTables_Table_")
                    ) {
                        extractGuildData();
                    }
                });
            }
        });
    });
    observer.observe(targetNode, {
        childList: true,
        subtree: true
    });
}
observeTables();