"""Vérifie les imports Gmail et la préservation des sources métier."""
from pathlib import Path
import xml.etree.ElementTree as ET


NS = {"atom": "http://www.w3.org/2005/Atom", "apps": "http://schemas.google.com/apps/2006"}


def read_filters(filename):
    root = ET.parse(Path("gmail_filters") / filename).getroot()
    filters = {}
    for entry in root.findall("atom:entry", NS):
        key = entry.findtext("atom:id", namespaces=NS)
        assert key and key not in filters, f"Identifiant absent ou dupliqué : {filename}"
        properties = entry.findall("apps:property", NS)
        values = {prop.attrib["name"]: prop.attrib["value"] for prop in properties}
        assert len(values) == len(properties), f"Propriété dupliquée : {key}"
        filters[key] = values
    return filters


full = read_filters("chez-papi-filters.xml")
update = read_filters("chez-papi-mailinblack-update.xml")
hors_scope_update = read_filters("chez-papi-hors-scope-update.xml")
prefix = "tag:mail.google.com,2008:filter:chez-papi-"
invitation_id = prefix + "authentification-mailinblack"
newsletter_id = prefix + "newsletters"
planity_id = prefix + "notifications-planity"
assert len(full) == 10, "La configuration complète doit contenir dix filtres"
assert set(update) == {invitation_id, newsletter_id, planity_id}, "L'import ciblé doit contenir les trois filtres concernés"
for key, values in update.items():
    assert values == full[key], f"Import ciblé désynchronisé : {key}"

ariba_id = prefix + "bons-commande-ariba"
facture_id = prefix + "notifications-facture-net"
assert set(hors_scope_update) == {ariba_id, facture_id}, "L'import hors périmètre doit contenir les deux filtres concernés"
for key, values in hors_scope_update.items():
    assert values == full[key], f"Import hors périmètre désynchronisé : {key}"
assert full[ariba_id] == {
    "from": "ordersender-prod@ansmtp.ariba.com",
    "shouldArchive": "true",
    "label": "Hors_Scope_Gmail",
}, "Seule l'adresse Ariba exacte doit être archivée, sans lecture ni suppression"
assert full[facture_id] == {
    "from": "notif.facture.net",
    "shouldArchive": "true",
    "label": "Hors_Scope_Gmail",
}, "Les notifications notif.facture.net doivent être archivées hors périmètre"

# Aucune action d'archivage, de suppression, de lecture ou de transfert.
assert full[invitation_id] == {
    "from": "invitations.mailinblack.com",
    "label": "Authentification_À_traiter",
}, "L'invitation doit uniquement recevoir son libellé"

assert full[planity_id] == {
    "from": "noreply@planity.com",
    "shouldArchive": "true",
    "label": "Hors_Scope_Gmail",
}, "Les notifications Planity doivent être archivées hors périmètre"

# Un second filtre peut archiver un message même si le premier le conserve.
newsletter_query = full[newsletter_id]["hasTheWord"].split()
for sender in [
    "invitations.mailinblack.com", "noreply@planity.com", "message@voxist.com", "no-reply@ovh.fr", "notifications@wix-forms.com",
    "demande.chezpapimaisongourmande@gmail.com", "chezpapimaisongourmande@gmail.com",
]:
    assert "-from:" + sender in newsletter_query, f"Source encore archivable comme newsletter : {sender}"

print("Filtres Gmail : XML valides, imports ciblés cohérents et sources métier préservées.")
