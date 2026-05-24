
import requests
import zipfile
import os
import io

URI : str = 'https://cdn.knmi.nl/knmi/map/page/klimatologie/gegevens/daggegevens/'
DIR : str = 'stationsdata/'

os.makedirs(DIR, exist_ok=True)

def downloadData(s: int) -> None:
    zipbestand : str = f'etmgeg_{s}.zip'
    url = f'{URI}{zipbestand}'

    # Download bestand
    r = requests.get(url)
    r.raise_for_status()

    # Uitpakken zonder opslaan op schijf
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        z.extractall(DIR)

def main() -> None:

    # download all station data
    STATIONS = [209, 210, 215, 225, 235, 240, 242, 248, 249, 251, 257, 258, 260, 265, 267,
                269, 270, 273, 275, 277, 278, 279, 280, 283, 285, 286, 290, 308, 310, 311,
                312, 313, 315, 316, 319, 323, 324, 330, 331, 340, 343, 344, 348, 350, 356,
                370, 375, 377, 380, 391]

    for s in STATIONS:
       print (f"downloading station {s}")
       downloadData(s)

if __name__ == '__main__':
    main()