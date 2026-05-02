import re
with open('c:/Users/Ananda/Documents/GitHub/voiceoftrisma/template/main/archive/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

ids_to_check = ['listContainer', 'list', 'pagination', 'countDisplay', 'searchIndicator', 'searchQ', 'repoView', 'repoTitle', 'repoSub', 'repoFilesList', 'repoReadme', 'readmeTitle', 'readmeText', 'readmePrograms', 'mainAudio', 'playPauseBtn', 'playerTitle', 'playerSub', 'volumeSlider', 'archiveLink', 'progressBar', 'timeText', 'playerThumb']

for idx in ids_to_check:
    if f'id="{idx}"' not in html and f"id='{idx}'" not in html:
        print(f'MISSING ID: {idx}')

if 'class="morph-path"' not in html:
    print('MISSING CLASS: morph-path')
