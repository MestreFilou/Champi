// Règles et sécurité : ce qui ne se déduit pas de la météo mais compte autant.
export default function BeforeYouGo({ place }) {
  const where = place?.name ? ` ${place.name}` : '';
  const search = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  return (
    <details className="card before">
      <summary><h3>Avant de partir</h3></summary>
      <ul>
        <li>
          <strong>Cueillette</strong> : tolérée pour un usage familial en forêt publique, souvent limitée en quantité par arrêté
          (préfecture, commune, ONF) et interdite dans les réserves. En forêt privée, il faut l’accord du propriétaire.{' '}
          <a href={search(`arrêté cueillette champignons${where}`)} target="_blank" rel="noreferrer">Chercher l’arrêté local</a>
        </li>
        <li>
          <strong>Chasse</strong> : de septembre à février, battues fréquentes le week-end et parfois en semaine. Porte une couleur
          vive et respecte les panneaux « chasse en cours ».{' '}
          <a href={search(`jours de chasse${where || ' forêt'}`)} target="_blank" rel="noreferrer">Jours de chasse{where}</a>
        </li>
        <li>
          <strong>Ne mange rien sans certitude</strong> : fais vérifier ta récolte par un pharmacien ou une association
          mycologique. Au moindre symptôme après un repas de champignons : <b>15</b> ou <b>112</b>, en gardant les restes.
        </li>
        <li>
          <strong>Seul en forêt</strong> : préviens un proche de ton secteur, pars avec la batterie chargée et lance le suivi
          de sortie pour retrouver ta voiture.
        </li>
      </ul>
    </details>
  );
}
