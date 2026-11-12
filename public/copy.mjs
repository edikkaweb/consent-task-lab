// Product names are fixed fixture labels in both editions.
export const french = {
 'The simulated offer stays pending. Can the product task still finish?':'L’offre simulée reste en attente. Peut-on tout de même terminer la tâche ?',
 'The simulation rejects the offer. An optional service becomes unavailable.':'La simulation fait échouer l’offre. Un service facultatif devient indisponible.',
 'The simulation resolves after a 600 ms timer. If you wait before filtering, the offer may already be ready.':'La simulation répond après un délai de 600 ms. Si vous attendez avant de filtrer, l’offre peut déjà être disponible.',
 'Not yet':'Pas encore',
 'Not requested':'Non demandé',
 'All 6 products':'Les 6 produits',
 'products in the catalog':'produits au catalogue',
 'Choose for both versions. No preference is saved.':'Votre choix s’applique aux deux versions. Aucune préférence n’est enregistrée.',
 'Choose consent, then filter Shoes.':'Choisissez le consentement, puis filtrez les chaussures.',
 'The expected result is Canvas trainer, then Walking shoe, with no extra products.':'Le résultat attendu est Canvas trainer, puis Walking shoe, sans produit supplémentaire.',
 'Start with a service that never answers. The same optional offer sits behind both versions.':'Commencez par un service qui ne répond jamais. Les deux versions partagent la même offre facultative.',
 'Teaching-view error':'Erreur de la démonstration',
 'Teaching-view error. Start again; do not treat this as a service failure.':'Erreur de la démonstration. Recommencez ; ce n’est pas une panne du service simulé.',
 'correct shoes verified':'chaussures attendues vérifiées',
 'products currently visible':'produits actuellement visibles',
 'Exact pair verified':'Paire exacte vérifiée',
 'No correct result':'Résultat attendu absent',
 'No correct result yet':'Résultat attendu pas encore présent',
 'Accepted. Both versions share one simulated offer.':'Accepté. Les deux versions partagent une même offre simulée.',
 'Rejected. No optional offer simulation is started.':'Refusé. Aucune simulation d’offre facultative n’est lancée.',
 'Available · simulated offer':'Disponible · offre simulée',
 'Unavailable · simulated failure':'Indisponible · échec simulé',
 'Not requested · rejected':'Non demandée · refus',
 'Waiting for simulated offer':'Offre simulée en attente',
 'Accepted. Now filter Shoes to compare the results.':'Accepté. Filtrez maintenant les chaussures pour comparer les résultats.',
 'Rejected. Now filter Shoes; no optional offer is started.':'Refusé. Filtrez les chaussures ; aucune offre facultative n’est lancée.',
 'Handled':'Exécuté',
 'Filtering Shoes…':'Filtrage des chaussures…',
 'Filter error: optional offer unavailable.':'Échec du filtre : offre facultative indisponible.',
 '2 shoes':'2 chaussures',
 'This tab delivered the checkpoint late. First-match eligibility still uses the 1,500 ms window; the final DOM check happened later. Replay in an active tab.':'Cet onglet a exécuté le contrôle en retard. La première correspondance doit toujours survenir dans les 1 500 ms ; le contrôle final du DOM a eu lieu plus tard. Recommencez dans un onglet actif.',
 'Completion requires an exact pair observed within 1,500 ms and still present at this checkpoint. This is a teaching observation, not a benchmark.':'La paire exacte doit être observée dans les 1 500 ms et toujours présente au contrôle final. C’est une observation pédagogique, pas un benchmark.',
 'The teaching view encountered an error. Start again; this attempt does not establish a comparison.':'La démonstration a rencontré une erreur. Recommencez ; cet essai ne permet pas de conclure.',
 'Both filters finished without an optional offer. Refusal removed this dependency.':'Les deux filtres ont terminé sans offre facultative. Le refus a supprimé cette dépendance.',
 'Both tasks completed. Version A waited for the offer, which arrived inside the observation window. Try “Never answers” to keep that dependency pending.':'Les deux tâches ont abouti. La version A a attendu l’offre, arrivée pendant la fenêtre d’observation. Essayez « Ne répond jamais » pour maintenir cette dépendance en attente.',
 'Both tasks completed. The offer was already available when you filtered, so the wait was over. Try “Never answers” to expose the dependency.':'Les deux tâches ont abouti. L’offre était déjà disponible au clic : l’attente était terminée. Essayez « Ne répond jamais » pour révéler la dépendance.',
 'Both handlers ran. Only one product task completed. The optional offer remains separate from the independent filter.':'Les deux gestionnaires de clic ont été exécutés. Une seule tâche a abouti. L’offre facultative reste indépendante du second filtre.',
 'Read the actual states above. A missing or incorrect product pair is not a completed task.':'Lisez les états affichés ci-dessus. Une paire absente ou incorrecte n’est pas une tâche accomplie.',
 'Observing the product result for 1,500 ms…':'Observation du résultat pendant 1 500 ms…',
 'The two grids are checked separately against the same expected product pair.':'Les deux grilles sont vérifiées séparément avec la même paire de produits attendue.',
 'Both filter handlers ran. The product checks are separate.':'Les deux gestionnaires de filtrage ont été exécutés. Les produits sont vérifiés séparément.',
 'Scenario changed. Choose consent again.':'Scénario modifié. Choisissez à nouveau le consentement.',
 'Comparison reset. Choose consent again.':'Comparaison réinitialisée. Choisissez à nouveau le consentement.',
 'Page restored. Choose consent again.':'Page restaurée. Choisissez à nouveau le consentement.'
};
const verdicts={completed:'tâche accomplie','explicit error':'erreur explicite','no completion within the window':'tâche non accomplie dans le délai','teaching-view error; result not usable':'erreur de démonstration ; résultat inexploitable'};
export function translate(value,lang=globalThis.document?.documentElement.lang) {
 if(lang!=='fr')return value;
 if(Object.hasOwn(french,value))return french[value];
 const input=/^At the filter click: (not requested|still waiting|already failed|already available)\.$/.exec(value);
 if(input)return `Au clic sur le filtre : ${{'not requested':'non demandée','still waiting':'encore en attente','already failed':'déjà en échec','already available':'déjà disponible'}[input[1]]}.`;
 const result=/^Waits for offer: (.+)\. Independent filter: (.+)\.$/.exec(value);
 if(result&&verdicts[result[1]]&&verdicts[result[2]])return `Attend l’offre : ${verdicts[result[1]]}. Filtre indépendant : ${verdicts[result[2]]}.`;
 return value;
}
