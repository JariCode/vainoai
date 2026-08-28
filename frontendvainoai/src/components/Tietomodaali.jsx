// Modaali joka kertoo lyhyesti miten VäinöAI toimii ja käsittelee tietoja.
// Sulkeutuu Sulje-napista tai taustaa klikkaamalla.
function Tietomodaali({ onSulje }) {
  return (
    <div className="modaali-tausta" onClick={onSulje}>
      <div className="modaali-laatikko" onClick={(e) => e.stopPropagation()}>
        <h2 className="modaali-otsikko">Tietoa palvelusta</h2>

        <p className="modaali-teksti">
          VäinöAI on kokeiluluontoinen keskustelupalvelu viihdekäyttöön. Käyttö on
          rajattu pääsykoodilla, joten palvelu ei ole avoin kaikille.
        </p>

        <p className="modaali-teksti">
          Väinö on tekoäly, ei ihminen. Älä luota sen vastauksiin faktana tai
          neuvona, äläkä kerro sille arkaluontoisia henkilötietoja.
        </p>

        <h3 className="modaali-alaotsikko">Tietojen käsittely</h3>
        <ul className="modaali-lista">
          <li>VäinöAI ei kerää eikä tallenna henkilötietoja. Keskusteluja ei tallenneta minnekään, vaan ne katoavat kun sivu suljetaan.</li>
          <li>Kun puhut, äänesi lähetetään OpenAI:lle vastauksen muodostamista varten. Muuta tietoa ei välitetä.</li>
          <li>Selaimeesi tallentuu vain väliaikainen sessiotunnus, joka poistuu itsestään. Se ei sisällä henkilötietoja.</li>
          <li>Palvelu ei käytä evästeitä eikä seuraa käyttöä.</li>
        </ul>

        <p className="modaali-teksti modaali-huomio">
          Palvelu tarjotaan sellaisenaan ilman takuuta.
        </p>

        <button className="modaali-nappi" onClick={onSulje}>Sulje</button>
      </div>
    </div>
  )
}

export default Tietomodaali