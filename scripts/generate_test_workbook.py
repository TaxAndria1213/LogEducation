from __future__ import annotations

from datetime import datetime
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "out" / "Cahier_Recette_Transport_Cantine.xlsx"


def col_letter(index: int) -> str:
    result = ""
    while index > 0:
        index, rem = divmod(index - 1, 26)
        result = chr(65 + rem) + result
    return result


def inline_text(value: str) -> str:
    text = "" if value is None else str(value)
    attrs = ' xml:space="preserve"' if text[:1].isspace() or text[-1:].isspace() else ""
    return f"<is><t{attrs}>{escape(text)}</t></is>"


def cell_xml(ref: str, value) -> str:
    if value is None:
      return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"><v>{value}</v></c>'
    return f'<c r="{ref}" t="inlineStr">{inline_text(str(value))}</c>'


def worksheet_xml(rows: list[list[object]]) -> str:
    row_xml = []
    for r_idx, row in enumerate(rows, start=1):
        cells = []
        for c_idx, value in enumerate(row, start=1):
            ref = f"{col_letter(c_idx)}{r_idx}"
            xml = cell_xml(ref, value)
            if xml:
                cells.append(xml)
        row_xml.append(f'<row r="{r_idx}">{"".join(cells)}</row>')

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<sheetData>"
        + "".join(row_xml)
        + "</sheetData></worksheet>"
    )


def workbook_xml(sheet_names: list[str]) -> str:
    sheets = []
    for idx, name in enumerate(sheet_names, start=1):
        sheets.append(
            f'<sheet name="{escape(name)}" sheetId="{idx}" r:id="rId{idx}"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheets>{''.join(sheets)}</sheets></workbook>"
    )


def workbook_rels_xml(sheet_count: int) -> str:
    rels = []
    for idx in range(1, sheet_count + 1):
        rels.append(
            f'<Relationship Id="rId{idx}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            f'Target="worksheets/sheet{idx}.xml"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(rels)
        + "</Relationships>"
    )


def content_types_xml(sheet_count: int) -> str:
    overrides = [
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/docProps/core.xml" '
        'ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]
    for idx in range(1, sheet_count + 1):
        overrides.append(
            f'<Override PartName="/xl/worksheets/sheet{idx}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        + "".join(overrides)
        + "</Types>"
    )


def package_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" '
        'Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" '
        'Target="docProps/app.xml"/>'
        "</Relationships>"
    )


def styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border/></borders>'
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
        '<cellXfs count="1"><xf xfId="0"/></cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '</styleSheet>'
    )


def core_xml() -> str:
    created = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<dc:title>Cahier de recette Transport et Cantine</dc:title>"
        "<dc:creator>Codex</dc:creator>"
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>'
        "</cp:coreProperties>"
    )


def app_xml(sheet_names: list[str]) -> str:
    titles = "".join(f"<vt:lpstr>{escape(name)}</vt:lpstr>" for name in sheet_names)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        "<Application>Microsoft Excel</Application>"
        f"<TitlesOfParts><vt:vector size=\"{len(sheet_names)}\" baseType=\"lpstr\">{titles}</vt:vector></TitlesOfParts>"
        f"<HeadingPairs><vt:vector size=\"2\" baseType=\"variant\"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>{len(sheet_names)}</vt:i4></vt:variant></vt:vector></HeadingPairs>"
        "</Properties>"
    )


def build_sheets() -> dict[str, list[list[object]]]:
    summary = [
        ["Rubrique", "Valeur", "Commentaire"],
        ["Document", "Cahier de recette Transport & Cantine", "Base de recette fonctionnelle"],
        ["Version", "1.0", "Genere a partir du systeme actuel"],
        ["Date de generation", datetime.now().strftime("%Y-%m-%d %H:%M"), "Heure locale poste"],
        ["Modules", "Scolarite, Transport, Cantine, Finance, Paiement", "Perimetre couvert"],
        ["UC couvertes", "UC-T01 a UC-T08 + UC-C01", "Transport complet et inscription cantine"],
        ["Pre-requis", "Base avec annee scolaire active", "Etablissement, eleves, lignes, formules, frais"],
        ["Statut initial execution", "A lancer", "Renseigner au fil de l'eau"],
        ["Note migration", "Appliquer la migration date_effet cantine avant recette", "Champ utilise par UC-C01"],
    ]

    data_rows = [
        ["Code", "Type", "Quantite", "Description", "Exemple / Valeurs"],
        ["ETAB-01", "Etablissement", 1, "Etablissement de recette", "Etablissement principal"],
        ["AS-01", "Annee scolaire", 1, "Annee active", "2025-2026 active"],
        ["CL-01", "Classe", 2, "Classes pour inscription", "6e A, 5e A"],
        ["ELV-01", "Eleve", 6, "Eleves de test", "Transport, cantine, cas d'anomalies"],
        ["TR-L-01", "Ligne transport", 2, "Lignes avec zones et arrets", "Ligne Nord, Ligne Centre"],
        ["TR-A-01", "Arret transport", 4, "Arrets relies aux lignes", "Arret Gare, Arret Mairie"],
        ["TR-Z-01", "Zone transport", 3, "Zones de tarification", "Nord, Centre, Sud"],
        ["CF-TR", "Catalogue frais", 2, "Frais transport", "Transport mensuel, Transport annuel"],
        ["FC-01", "Formule cantine", 3, "Formules cantine", "Forfait, Unitaire, Abonnement"],
        ["CF-CA", "Catalogue frais", 2, "Frais cantine", "Cantine forfait, Cantine abonnement"],
        ["USR-TR", "Utilisateur", 2, "Profils transport", "Agent transport, Responsable transport"],
        ["USR-CA", "Utilisateur", 2, "Profils cantine", "Agent cantine, Responsable cantine"],
        ["USR-FI", "Utilisateur", 1, "Profil finance", "Agent Finance"],
    ]

    tests_header = [
        "ID",
        "Module",
        "UC",
        "Priorite",
        "Titre",
        "Preconditions",
        "Etapes",
        "Resultat attendu",
        "Donnees de test",
        "Statut",
        "Resultat obtenu",
        "Anomalie / Ticket",
        "Preuve",
    ]

    tests = [
        ["T01-01", "Transport", "UC-T01", "Haute", "Inscription transport standard", "Eleve existant, ligne ouverte, zones parametrees", "1. Ouvrir formulaire transport\n2. Choisir eleve\n3. Choisir ligne, arret, zone, periode\n4. Enregistrer\n5. Valider le workflow\n6. Traiter la facturation dans Finance\n7. Payer la facture", "Abonnement cree, dossier en attente Finance puis ACTIF apres paiement", "ELV-01, TR-L-01, TR-A-01, TR-Z-01", "", "", "", ""],
        ["T01-02", "Scolarite/Transport", "UC-T01", "Haute", "Inscription scolaire avec service transport", "Classe, eleve et ligne transport disponibles", "1. Creer inscription scolaire\n2. Activer transport\n3. Choisir ligne, zone, dates\n4. Valider l'inscription\n5. Controler le statut de l'abonnement transport", "Abonnement transport cree en attente interne/financiere sans paiement local", "ELV-02, CL-01", "", "", "", ""],
        ["T02-01", "Transport", "UC-T02", "Haute", "Changement de circuit sans impact tarifaire", "Abonnement transport deja actif", "1. Ouvrir dossier transport\n2. Changer circuit/arret sans changer tarif\n3. Valider", "Nouvelle affectation enregistree, historique cree, pas de regularisation inutile", "ELV-01", "", "", "", ""],
        ["T02-02", "Transport", "UC-T02", "Haute", "Changement de zone avec impact tarifaire", "Abonnement actif, zones tarifaires distinctes", "1. Changer la zone\n2. Valider\n3. Ouvrir Finance\n4. Generer regularisation", "Historique cree, Finance notifie, regularisation generee, statut mis a jour", "ELV-01, TR-Z-01", "", "", "", ""],
        ["T03-01", "Transport", "UC-T03", "Haute", "Controle d'acces eleve autorise", "Abonnement actif et regle", "1. Ouvrir controle d'acces\n2. Rechercher l'eleve", "Circuit, periode, finance_status et acces AUTORISE affiches", "ELV-01", "", "", "", ""],
        ["T03-02", "Transport", "UC-T03", "Haute", "Controle d'acces eleve suspendu", "Abonnement suspendu par Finance", "1. Rechercher l'eleve suspendu", "Acces SUSPENDU affiche avec statut financier coherent", "ELV-03", "", "", "", ""],
        ["T04-01", "Transport/Finance", "UC-T04", "Haute", "Suspension pour impaye avec validation humaine", "Abonnement impaye, ligne avec validation humaine active", "1. Signaler suspension depuis Finance\n2. Valider cote Transport\n3. Rejouer le controle d'acces", "Statut suspendu persistant, notification generee, acces bloque", "ELV-03", "", "", "", ""],
        ["T05-01", "Transport/Finance", "UC-T05", "Haute", "Reactivation apres regularisation", "Abonnement transport suspendu", "1. Regler la facture\n2. Verifier le statut du service\n3. Consulter l'historique", "Abonnement repasse ACTIF, audit de reactivation present", "ELV-03", "", "", "", ""],
        ["T06-01", "Transport/Finance", "UC-T06", "Haute", "Prorata entree en cours de mois", "Ligne transport en mode MONTH", "1. Creer abonnement avec date de debut en cours de mois\n2. Generer la facturation Finance", "Prorata applique et statut coherent avec la reponse Finance", "ELV-04", "", "", "", ""],
        ["T06-02", "Transport/Finance", "UC-T06", "Moyenne", "Prorata sortie en cours de periode", "Abonnement deja facture", "1. Mettre a jour la periode d'usage\n2. Generer la regularisation Finance", "Evenement transmis, regularisation calculee, statut coherent", "ELV-04", "", "", "", ""],
        ["T07-01", "Transport", "UC-T07", "Haute", "Liste d'exploitation par date et circuit", "Abonnements transport existants", "1. Ouvrir controle d'acces transport\n2. Filtrer par date\n3. Filtrer par circuit\n4. Exporter CSV", "Liste fiable des eleves transportes pour la fenetre choisie", "TR-L-01", "", "", "", ""],
        ["T08-01", "Transport/Finance", "UC-T08", "Haute", "Anomalie transporte sans droit financier", "Eleve en liste transport mais finance non autorise", "1. Ouvrir dashboard transport\n2. Rafraichir le rapprochement", "Anomalie ouverte visible et actionnable", "ELV-05", "", "", "", ""],
        ["T08-02", "Transport/Finance", "UC-T08", "Haute", "Anomalie paye sans affectation transport", "Facture reglee sans abonnement transport actif", "1. Ouvrir rapprochement\n2. Controler les anomalies", "Anomalie visible, tracable et corrigeable", "ELV-06", "", "", "", ""],
        ["T08-03", "Transport/Finance", "UC-T08", "Haute", "Anomalie suspendu avec usage reel", "Abonnement suspendu avec pointage reel", "1. Pointer un passage reel\n2. Ouvrir les anomalies", "Anomalie de type usage reel visible", "ELV-03", "", "", "", ""],
        ["C01-01", "Cantine", "UC-C01", "Haute", "Inscription cantine standard", "Eleve existant, formule cantine parametree", "1. Ouvrir formulaire cantine\n2. Choisir eleve et formule\n3. Saisir date d'effet\n4. Enregistrer", "Demande cantine creee en attente de validation financiere", "ELV-01, FC-01", "", "", "", ""],
        ["C01-02", "Finance/Cantine", "UC-C01", "Haute", "Facturation cantine depuis Finance", "Demande cantine en attente Finance", "1. Ouvrir dashboard Finance\n2. Traiter la file Cantine a facturer\n3. Generer la facture", "Facture cantine creee, abonnement passe en attente de reglement ou actif si deja paye", "ELV-01", "", "", "", ""],
        ["C01-03", "Paiement/Cantine", "UC-C01", "Haute", "Activation cantine apres paiement", "Facture cantine emise", "1. Regler la facture\n2. Ouvrir la liste cantine", "Abonnement cantine passe ACTIF et le statut financier est mis a jour", "ELV-01", "", "", "", ""],
        ["C01-04", "Scolarite/Cantine", "UC-C01", "Moyenne", "Inscription scolaire avec service cantine", "Formule cantine et annee active", "1. Creer inscription scolaire\n2. Activer cantine\n3. Choisir formule\n4. Valider l'inscription", "Abonnement cantine cree sans facturation locale, en attente Finance", "ELV-02, FC-01", "", "", "", ""],
    ]

    return {
        "Synthese": summary,
        "JeuDonnees": data_rows,
        "CahierRecette": [tests_header, *tests],
    }


def build_workbook(path: Path) -> None:
    sheets = build_sheets()
    sheet_names = list(sheets.keys())
    path.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(path, "w", compression=ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml(len(sheet_names)))
        zf.writestr("_rels/.rels", package_rels_xml())
        zf.writestr("docProps/core.xml", core_xml())
        zf.writestr("docProps/app.xml", app_xml(sheet_names))
        zf.writestr("xl/workbook.xml", workbook_xml(sheet_names))
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml(len(sheet_names)))
        zf.writestr("xl/styles.xml", styles_xml())
        for idx, name in enumerate(sheet_names, start=1):
            zf.writestr(f"xl/worksheets/sheet{idx}.xml", worksheet_xml(sheets[name]))


if __name__ == "__main__":
    build_workbook(OUTPUT)
    print(OUTPUT)
