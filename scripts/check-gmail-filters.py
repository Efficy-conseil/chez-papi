"""Vérifie les imports Gmail et la visibilité des invitations Mailinblack."""
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
prefix = "tag:mail.google.com,2008:filter:chez-papi-"
invitation_id = prefix + "authentification-mailinblack"
newsletter_id = prefix + "newsletters"
assert len(full) == 7, "La configuration complète doit contenir sept filtres"
assert set(update) == {invitation_id, newsletter_id}, "L'import ciblé doit contenir seulement les deux filtres concernés"
for key, values in update.items():
    assert values == full[key], f"Import ciblé désynchronisé : {key}"

# Aucune action d'archivage, de suppression, de lecture ou de transfert.
assert full[invitation_id] == {
    "from": "invitations.mailinblack.com",
    "label": "Authentification_À_traiter",
}, "L'invitation doit uniquement recevoir son libellé"

# Un second filtre peut archiver un message même si le premier le conserve.
newsletter_query = full[newsletter_id]["hasTheWord"].split()
for sender in [
    "invitations.mailinblack.com", "noreply@planity.com", "message@voxist.com", "notifications@wix-forms.com",
    "demande.chezpapimaisongourmande@gmail.com", "chezpapimaisongourmande@gmail.com",
]:
    assert "-from:" + sender in newsletter_query, f"Source encore archivable comme newsletter : {sender}"

print("Filtres Gmail : XML valides, import ciblé cohérent, invitations visibles et sources métier préservées.")
