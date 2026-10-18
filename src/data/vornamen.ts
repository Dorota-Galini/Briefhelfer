// Häufige Vornamen in Deutschland, kleingeschrieben, für die lokale Namenserkennung.
// Bewusst NICHT enthalten: Vornamen, die auch normale Wörter oder Monate sind
// (z. B. Mai, August, Ernst, Rose, Frank, Will, Roman, Iris, Nur, Mark, Milan, Sofia), um Fehltreffer zu vermeiden.
// Liste darf gern ergänzt werden: ein Name pro Leerzeichen.

const DEUTSCH = `
adam adrian agnes alexander alexandra alfred alina alfons alois amelie andrea andreas angela angelika anja anke anna annabell anne annegret anneliese annette anni annika antje anton antonia arne arnd arnold artur astrid axel
barbara bärbel beate beatrix ben benedikt benjamin bernd bernhard berta bertram bettina birgit birte björn bodo brigitte britta bruno burkhard
carina carl carla carlo carmen carola caroline carsten catharina charlotte christa christel christian christiane christina christine christoph christopher clara claudia claus clemens cora cornelia
dagmar daniel daniela david dennis detlef detlev diana dieter dietmar dietrich dirk doris dominik dorothea dorothee
eberhard edith edgar egon ekkehard elena elfriede elias elisabeth elke ella elli ellen elmar elsa else emil emilia emily emma enrico erich erik erika erna erwin esther eugen eva evelyn
fabian felix ferdinand finn florian franz franziska frauke frieda friedhelm friedrich frida fritz
gabriele georg gerald gerd gerda gerhard gerlinde gernot gertrud gisela gregor greta grete gudrun guido günter günther gunter gustav
hanna hannah hannelore hannes hans hansjörg harald harry hartmut hedwig heike heiko heinrich heino heinz helena helene helga helmut helmuth henning henrik henry herbert hermann hertha hilde hildegard holger horst hubert hugo
ida ilona ilse imke ina inge ingeborg ingo ingrid irene irmgard isabel isabell isabella
jakob jan jana janina janine jannik jasmin jens jessica joachim jochen johann johanna johannes jonas jonathan jörg josef josefine judith julia julian juliane julius jürgen justus jutta
kai karin karl karla karl-heinz karolina karsten katharina kathrin katja katrin kerstin kevin kilian kim klara klaus konrad konstantin kristina kurt
lara laura lea lena leni leo leon leonie lieselotte lilli lina linda lisa liselotte lothar lotte louis luca lucas luis luisa luise lukas lutz
maik malte manfred manuel manuela mara marc marcel marco mareike margarete margit margot maria marianne marie marina mario marion marius markus marlene marta martha martina marvin mathias matthias max maximilian melanie meike merle mia michael michaela mila mirco mirjam mona monika moritz
nadine nadja natalie nicole niklas nico nicolas nils nina noah norbert
olaf olga oliver oskar otto
patricia patrick paul paula pauline peter petra philipp pia
rainer ralf ralph regina reinhard reinhold renate rene rené richard rita robert robin roland rolf ronja rosemarie rosi rüdiger rudolf ruth
sabine sabrina sandra sara sarah sascha sebastian siegfried sieglinde silke silvia simon simone sina sophia sophie stefan stefanie steffen stephan stephanie susanne svea sven svenja swen sylvia
tanja theo theresa thilo thomas thorsten tilo tim timo tina tobias torsten udo ulf ulla ulrich ulrike ursula uta ute uwe
valentin valerie vanessa vera verena veronika viktor viktoria vincent volker
waltraud walter werner wilfried wilhelm wilma winfried wolfgang yannick yvonne
`;

const POLNISCH = `
agata agnieszka aleksander aleksandra alicja andrzej aneta aniela antoni barbara bartłomiej bartosz beata bogdan bogusław bożena czesław damian danuta dariusz dawid dominika dorota edyta elżbieta emilia ewa ewelina filip franciszek grażyna grzegorz halina hanna henryk igor irena iwona izabela jacek jadwiga jakub janina janusz jarosław jerzy joanna jolanta józef julia justyna kamil kamila karol karolina katarzyna kazimierz kinga krystyna krzysztof łukasz maciej magdalena małgorzata marek mariusz marta marzena mateusz michał mikołaj mirosław monika natalia oliwia patrycja paulina paweł piotr przemysław rafał renata robert ryszard sebastian stanisław stefan sylwia szymon tadeusz teresa tomasz urszula wanda weronika wiesław wiktor wiktoria witold władysław wojciech zbigniew zdzisław zofia zuzanna
`;

const TUERKISCH = `
ahmet ali alper arda aslı ayhan aylin ayşe aysel aysun ayten bahar barış belgin berk berkay betül burak burcu can canan cem cemal cengiz derya deniz dilek ebru eda elif emel emine emre engin erdem erkan esra fatma ferhat feride gamze gizem gül gülay gülsen güler hakan halil hande harun hasan hatice hülya hüseyin ibrahim ilhan ismail kadir kemal kerem kübra leyla mahmut melek meltem merve mehmet mert metin murat mustafa nazlı necla nermin nesrin nihat nuray onur orhan osman özge özlem recep sabri seda selin selma semra serkan sevgi sevim sibel songül sultan şükrü tarık tuba tuncay tülay ufuk ümit volkan yasemin yavuz yeliz yılmaz yusuf zehra zeynep
`;

const ARABISCH = `
abdul abdullah abdulrahman adel ahmad ahmed aisha alaa amal amina amir amira anas asma ayman aziz bilal fadi farah fares fatima fatma ghada habib hadi hamza hana hassan hiba hussein ibrahim imad iman jamal karim khaled khalid laila layla lina mahmoud majid malak mariam maryam mohamed mohammad mohammed mona mostafa muhammad mustafa nabil nadia nasser nour omar osama rami rana rania reem saad said salah salim salma sami samir sara shadi tarek wael walid yasmin yassin yousef youssef zainab zaid ziad
`;

const OSTEUROPAEISCH = `
alexej alla anastasia andrij andrej andriy anton bogdana daria darja denys dmitri dmitrij dmytro galina halyna igor irina iryna ivan iwan jelena jewgeni jurij kateryna kirill larissa ljudmila lyudmyla maksym maxim mykola mykhailo natalja nataliya natalia nikolai oksana oleg oleksandr oleksandra olena olha olga pavlo polina ruslan sergej serhij serhii svetlana swetlana taras tatjana tetiana valentina viktoria vitali vitalij vladimir volodymyr wadim waldemar wassili wladimir yulia yuliia yurii julija
`;

const SUEDEUROPAEISCH = `
alessandro alessia andrea angelo antonio carlos chiara cristina davide domenico elena enzo fabio federico francesca francesco gianluca giorgio giovanni giulia giuseppe isabella javier jorge josé juan laura lorenzo luca lucia luigi manuel marco maria mario martina massimo matteo miguel paolo pedro pietro raffaele roberto salvatore sergio stefano valentina vincenzo
ana ante branko darko dragan dušan goran ivana jovana luka marija marko milica miroslav nikola petar predrag sanja snežana stefan tamara vesna zoran
dimitrios georgios ioannis konstantinos maria nikolaos eleni katerina panagiotis vasileios
`;

const ENGLISCH = `
alice amanda amy andrew anthony ashley brian charles chris daniel david edward elizabeth emily george james jason jennifer jessica john jonathan joseph joshua kate kelly kevin laura linda mary matthew michael nancy olivia richard robert ryan sarah steven susan thomas william
`;

export const VORNAMEN = new Set(
  [DEUTSCH, POLNISCH, TUERKISCH, ARABISCH, OSTEUROPAEISCH, SUEDEUROPAEISCH, ENGLISCH]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean),
);
