import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Règlement — La Chance du 5",
  robots: { index: false, follow: false },
};

// Règlement rédigé par Harvey le 28/07/2026.
// Source de vérité (version complète, avec les champs à compléter) :
// Desktop/2 – GLG HOSPITALITY/2.1 – Le 5/2.1.3 – Marketing & Identité/
//   20260728_LE5_Reglement-Jeu-Loterie-QR_V1.md
// ⚠️ Toute modification de la grille de lots (services/lottery.py) doit être
// répercutée à l'article 4 — c'est un engagement contractuel envers le joueur.

function Article({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 font-serif text-lg text-[#f0c674]">
        {n} — {title}
      </h2>
      <div className="space-y-2 text-[13px] leading-relaxed text-[#fff7ed]/80">{children}</div>
    </section>
  );
}

export default async function ReglementPage({
  params,
}: {
  params: Promise<{ restaurant: string }>;
}) {
  const { restaurant } = await params;

  return (
    <div className="min-h-[100dvh] bg-[#2d1b3d]">
      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <Link
          href={`/${restaurant}/jeu`}
          className="text-[13px] text-[#fff7ed]/60 underline underline-offset-2 hover:text-[#f0c674]"
        >
          ← Retour au jeu
        </Link>

        <h1 className="mb-1 mt-6 font-serif text-3xl text-[#fff7ed]">
          Règlement du jeu
        </h1>
        <p className="mb-8 text-sm text-[#fff7ed]/60">
          {"« La Chance du 5 » — en vigueur depuis le 28 juillet 2026"}
        </p>

        <Article n="Article 1" title="Organisateur">
          <p>
            {
              "La société GLG HOSPITALITY, société par actions simplifiée immatriculée au RCS de Créteil sous le numéro 940 111 909, exploitant l'établissement Le 5, sis 4/5 place du Village, 94370 Sucy-en-Brie (SIRET 940 111 909 00021), ci-après « l'Organisateur »."
            }
          </p>
        </Article>

        <Article n="Article 2" title="Durée">
          <p>
            {
              "Le jeu est organisé pour une durée de six (6) mois, tacitement reconductible, sauf annonce contraire publiée sur la page du jeu."
            }
          </p>
        </Article>

        <Article n="Article 3" title="Conditions de participation">
          <p>
            {
              "3.1. Le jeu est ouvert à toute personne physique majeure (18 ans révolus) résidant en France métropolitaine, cliente de l'établissement Le 5."
            }
          </p>
          <p>
            {
              "3.2. La participation s'effectue en scannant le QR code figurant sur l'addition, puis en renseignant un prénom et un numéro de téléphone mobile français (06 ou 07, 10 chiffres)."
            }
          </p>
          <p>
            {
              "3.3. La participation est gratuite et sans obligation d'achat supplémentaire. Aucun frais n'est engagé par le participant au titre du jeu."
            }
          </p>
          <p className="text-[#fff7ed]">
            {
              "3.4. La participation n'est subordonnée à aucune autre condition. Elle n'est notamment subordonnée ni à la publication d'un avis en ligne, ni à un abonnement à un compte de réseau social, ni à l'acceptation de recevoir des communications commerciales."
            }
          </p>
          <p>
            {
              "3.5. Une seule participation est autorisée par numéro de téléphone par période de sept (7) jours glissants. Le contrôle est automatique. Toute tentative de contournement entraîne l'annulation des gains associés."
            }
          </p>
          <p>
            {"3.6. Sont exclus du jeu les dirigeants et salariés de l'Organisateur, ainsi que les membres de leur foyer."}
          </p>
        </Article>

        <Article n="Article 4" title="Dotation et probabilités de gain">
          <p>{"Le tirage au sort est instantané et automatisé. Les probabilités sont les suivantes :"}</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>{"Un café — 13 %"}</li>
            <li>{"Un verre de vin (12,5 cl) — 9 %"}</li>
            <li>{"Une bière (25 cl) — 8 %"}</li>
            <li>{"Une planche de charcuterie ou de fromage, ou un cocktail, au choix de l'Organisateur selon disponibilité — 3 %"}</li>
            <li>{"Aucun gain — 67 %"}</li>
          </ul>
          <p>{"Soit une probabilité globale de gain de 33 %."}</p>
          <p>
            {
              "L'Organisateur se réserve le droit de plafonner à dix (10) le nombre de lots de la catégorie « planche ou cocktail » attribués par mois calendaire. Au-delà, les tirages gagnants de cette catégorie sont automatiquement réattribués aux catégories café, verre de vin ou bière."
            }
          </p>
        </Article>

        <Article n="Article 5" title="Remise des lots">
          <p>{"5.1. Le lot est consommable sur place uniquement, dans l'établissement Le 5, lors d'une visite ultérieure."}</p>
          <p>
            {
              "5.2. Le lot est valable trente (30) jours calendaires à compter de la date du tirage. Passé ce délai, il est définitivement perdu sans contrepartie."
            }
          </p>
          <p>
            {
              "5.3. Pour obtenir son lot, le gagnant communique son prénom et son numéro de téléphone au personnel de salle, qui vérifie le gain et le valide. Aucun code ni justificatif n'est exigé."
            }
          </p>
          <p>{"5.4. Les lots ne sont ni cessibles, ni échangeables, ni remboursables, et ne peuvent donner lieu à aucune contrepartie en espèces."}</p>
          <p className="text-[#fff7ed]">
            {
              "5.5. Lots comportant des boissons alcoolisées. Conformément à l'article L. 3342-1 du Code de la santé publique, aucune boisson alcoolisée n'est remise, à titre gratuit ou onéreux, à une personne mineure. Le personnel est habilité à demander une pièce d'identité. Le gagnant mineur ou ne pouvant justifier de sa majorité se voit proposer un lot de substitution sans alcool de valeur équivalente."
            }
          </p>
          <p>{"5.6. Un lot ne peut être cumulé avec une autre offre promotionnelle en cours dans l'établissement."}</p>
        </Article>

        <Article n="Article 6" title="Données personnelles">
          <p>{"6.1. Responsable de traitement : GLG HOSPITALITY."}</p>
          <p>{"6.2. Données collectées : prénom, numéro de téléphone mobile, date et résultat de participation, statut du lot."}</p>
          <p>{"6.3. Finalités, bases légales et durées de conservation :"}</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              {
                "Organisation du jeu, contrôle de l'unicité de participation, attribution et remise des lots — base légale : exécution du présent règlement (art. 6.1.b RGPD) — conservation : 3 mois après le tirage."
              }
            </li>
            <li>
              {
                "Envoi d'informations par SMS relatives à l'établissement (actualités, événements, offres et informations de l'établissement) — base légale : consentement (art. 6.1.a RGPD et art. L. 34-5 CPCE) — conservation : 3 ans à compter du dernier contact, ou jusqu'au retrait du consentement."
              }
            </li>
          </ul>
          <p className="text-[#fff7ed]">
            {
              "6.4. Le consentement à la prospection commerciale est facultatif. Il est recueilli par une case à cocher distincte et non pré-cochée. Le refus de consentir n'empêche en aucune manière la participation au jeu ni l'attribution d'un lot."
            }
          </p>
          <p>
            {
              "6.5. Destinataires : l'Organisateur et, le cas échéant, son prestataire technique d'envoi de SMS agissant en qualité de sous-traitant. Aucune cession ni location à des tiers."
            }
          </p>
          <p>
            {
              "6.6. Droits des participants : accès, rectification, effacement, limitation, opposition, portabilité, et retrait du consentement à tout moment, par simple demande sur place ou par la mention « STOP » figurant dans chaque SMS. Réclamation possible auprès de la CNIL (www.cnil.fr)."
            }
          </p>
        </Article>

        <Article n="Article 7" title="Absence d'association aux plateformes tierces">
          <p>
            {
              "7.1. Le jeu n'est en aucune manière organisé, parrainé, administré ou associé à Meta Platforms Inc. (Facebook, Instagram) ni à Google LLC. Les participants dégagent ces sociétés de toute responsabilité au titre du jeu."
            }
          </p>
          <p>
            {
              "7.2. Les liens vers les pages Instagram, Facebook et la fiche Google de l'établissement constituent une simple invitation facultative, sans contrepartie d'aucune sorte et sans influence sur la participation ou sur les chances de gain."
            }
          </p>
          <p className="text-[#fff7ed]">
            {
              "7.3. Aucun avis en ligne n'est sollicité en échange d'un avantage, d'un lot ou d'une chance supplémentaire de gain, et aucune orientation n'est faite en fonction de la note que le client envisage d'attribuer."
            }
          </p>
        </Article>

        <Article n="Article 8" title="Modification, suspension, annulation">
          <p>
            {
              "L'Organisateur se réserve le droit de modifier, prolonger, écourter, suspendre ou annuler le jeu à tout moment, notamment en cas de force majeure ou de fraude, sans que sa responsabilité puisse être engagée."
            }
          </p>
        </Article>

        <Article n="Article 9" title="Acceptation du règlement">
          <p>
            {
              "La participation au jeu emporte acceptation pleine et entière du présent règlement, accessible gratuitement sur la page du jeu pendant toute sa durée."
            }
          </p>
        </Article>

        <Article n="Article 10" title="Litiges — Droit applicable">
          <p>
            {
              "Le présent règlement est soumis au droit français. Toute réclamation doit être adressée à l'Organisateur dans un délai de trente (30) jours suivant la fin du jeu. À défaut d'accord amiable, les tribunaux français sont seuls compétents."
            }
          </p>
        </Article>

        <p className="mt-10 border-t border-white/10 pt-6 text-center text-[11px] text-[#fff7ed]/40">
          {"L'abus d'alcool est dangereux pour la santé. À consommer avec modération."}
        </p>
      </div>
    </div>
  );
}
