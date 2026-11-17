# Tally connector (Windows)

1. On the Tally PC, in TallyPrime: F1 Help > Settings > Connectivity > set **TallyPrime acts as: Both** and **Port: 9000**. Keep the Crayon company open.
2. Copy `config.example.ini` to `config.ini` and paste the `TALLY_CONNECTOR_KEY` from the Vercel project settings.
3. Build the .exe once (on any Windows PC with Python 3.11+):
   `pip install pyinstaller` then `pyinstaller --onefile --name CrayonTallyConnector connector.py`
4. Put `CrayonTallyConnector.exe` and `config.ini` in `C:\CrayonTallyConnector\`.
5. Install it as a Windows service that starts with the PC, using NSSM (nssm.cc):
   `nssm install CrayonTallyConnector C:\CrayonTallyConnector\CrayonTallyConnector.exe`
   then `nssm start CrayonTallyConnector`.
6. Check `connector.log` in the same folder, and the **Tally sync** page in the ERP.

Test without installing: `python connector.py --once`.
