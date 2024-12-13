async function extractGuildData() {
    const playersElements = document.querySelectorAll(".players-table-name-guild-realm");
    if (playersElements.length === 0) {
        console.error("Error Couldnt find registers");
        setTimeout(extractGuildData, 5000);
        return;
    }
    const url = window.location.href;
    const raidIdMatch = url.match(/\/zone\/rankings\/(\d+)/);
    const raidId = raidIdMatch ? raidIdMatch[1] : null;
    if (raidId == null) {
        console.error("Error Couldnt find Raid to track");
        setTimeout(extractGuildData, 5000);
        return;
    }
    var raid = "";
    if (raidId == 38) {
        raid = "nerubar-palace";
    } else if (raidId == 40) {
        raid = "blackrock-depths";
    } else {
        console.error("Error Couldnt detect the Raid");
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
        const url = `${baseUrl}?region=${regionParam}&realm=${realmParam}&name=${playerParam}&fields=guild`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`WR_RANKS Error : ${response.status} ${response.statusText}. URL: ${url}`);
            return;
        }

        const data = await response.json();
        return data["guild"]?.["realm"];
    } catch (error) {
        console.error("WR_RANKS Error:", error);
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

        const url = `${baseUrl}?region=${regionParam}&realm=${realmParam}&name=${guildParam}&fields=raid_rankings:${raidParam}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`WR_RANKS Error : ${response.status} ${response.statusText}. URL: ${url}`);
            return;
        }

        const data = await response.json();
        const mythicWorldRanking = data?.raid_rankings?.[raid]?.mythic?.world;
        if (mythicWorldRanking) {
            saveToCache(region, realm, guild, raid, mythicWorldRanking);
            addWRToElement(mythicWorldRanking, guildElement);
        }

    } catch (error) {
        console.error("WR_RANKS Error:", error);
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