#!/usr/bin/env python3
"""Writes src/set.json: the single source of truth for all 100 cards.

The app reads it for names, numbers, stats and artists; scripts/art.mjs reads it for what to draw.
Edit the tables here and run `python3 scripts/build-set.py` to regenerate the JSON.

Base cards: id, name, type, artist, power, era, diet, size, move 1 (name, cost, damage),
move 2 (name, cost, damage), fact, scene (what the picture shows).
Types: L leaf, R rock, S sky, W water, F fire, T storm.
"""
import json
import pathlib

TYPES = {'L': 'leaf', 'R': 'rock', 'S': 'sky', 'W': 'water', 'F': 'fire', 'T': 'storm'}
J, K, TR = 'Jurassic', 'Cretaceous', 'Triassic'
PLANT, MEAT, FISH, BUGS, ALL = 'Plant-eater', 'Meat-eater', 'Fish-eater', 'Bug-eater', 'Eats anything'

# The invented artists. The names are printed on the cards; scripts/art.mjs holds how each one draws.
ARTISTS = {
    'crayon': 'Pip Scribble', 'watercolour': 'Wren Loch', 'pixel': 'Bea Bitmap', 'spray': 'Dax One',
    'storybook': 'Odette Fable', 'gold': 'The Goldsmith', 'mabel': 'Mabel, age 6', 'collage': 'Otto Papier',
    'clay': 'Dot Morrow', 'lino': 'Ines Block', 'shapes': 'Bruno Kube', 'toon': 'Sunny Hollis', 'kawaii': 'Momo Chi',
    'glass': 'Vitra Lux', 'chalk': 'Miss Tavish', 'felt': 'Nana Stitch', 'ink': 'Kaze', 'cave': 'Og', 'neon': 'Vega',
    'biro': 'Ben, Class 4B', 'origami': 'Ori Fold', 'swirl': 'Flora Swirl',
}

COMMON = [
    # The ten headliners as babies.
    ('baby-rex', 'Baby T. Rex', 'F', 'mabel', 50, K, MEAT, '1 m long', 'Tiny Roar', 1, 10, 'Nibble', 2, 30,
     'A baby T. rex was fluffy, and about the size of a turkey when it hatched.',
     'A baby Tyrannosaurus rex standing next to a volcano, roaring, with tiny arms.'),
    ('baby-spino', 'Baby Spinosaurus', 'W', 'toon', 50, K, FISH, '1.5 m long', 'Splash', 1, 10, 'Fish Snap', 2, 30,
     'Even a young Spinosaurus had a little sail, and could paddle after fish.',
     'A baby Spinosaurus with a small sail on its back, sitting in a shallow pond and proudly holding up one tiny fish in its mouth, facing the viewer.'),
    ('baby-trike', 'Baby Triceratops', 'L', 'clay', 50, K, PLANT, '1 m long', 'Head Bump', 1, 10, 'Frill Wiggle', 2, 20,
     'A baby Triceratops had three tiny stubs where its horns would grow.',
     'A baby Triceratops with a frill and three stubby horns, sitting on its bottom and facing the viewer, hatching from a big cracked egg.'),
    ('baby-raptor', 'Baby Velociraptor', 'T', 'biro', 40, K, MEAT, '50 cm long', 'Pounce', 1, 10, 'Tiny Claws', 2, 30,
     'Baby raptors were covered in soft feathers, like a chick.',
     'A fluffy feathered baby Velociraptor mid-pounce onto a beetle, seen from the side, leaping towards the LEFT.'),
    ('baby-brachio', 'Baby Brachiosaurus', 'L', 'felt', 60, J, PLANT, '2 m long', 'Neck Stretch', 1, 10, 'Leaf Munch', 2, 30,
     'It hatched from an egg the size of a football, and grew taller than a house.',
     'A baby Brachiosaurus with a long neck, stretching up on tiptoe to reach a single leaf just out of reach, seen from the side, facing right.'),
    ('baby-anky', 'Baby Ankylosaurus', 'R', 'clay', 50, K, PLANT, '1 m long', 'Curl Up', 1, 10, 'Tail Tap', 2, 20,
     'Its armour started soft and grew harder as it got older.',
     'A baby Ankylosaurus with bumpy armour and a tiny tail club, curled into a ball, peeking out with one eye, seen from above.'),
    ('baby-giga', 'Baby Giganotosaurus', 'F', 'mabel', 50, K, MEAT, '1 m long', 'Stomp', 1, 10, 'Little Chomp', 2, 30,
     'One day it would be even longer than a T. rex.',
     'A baby Giganotosaurus with a very big head, chasing a butterfly, running towards the LEFT.'),
    ('baby-stego', 'Baby Stegosaurus', 'L', 'kawaii', 50, J, PLANT, '1 m long', 'Snooze', 1, 10, 'Plate Shake', 2, 20,
     'Its back plates were tiny at first and grew as it did.',
     'A baby Stegosaurus with a row of little back plates and a spiky tail, curled up asleep.'),
    ('baby-allo', 'Baby Allosaurus', 'F', 'kawaii', 50, J, MEAT, '1 m long', 'Yawn', 1, 10, 'Snap', 2, 30,
     'Young Allosaurus had long legs for their size and were quick runners.',
     'A baby Allosaurus with two small bumps above its eyes, sitting up with a huge yawn, facing the viewer.'),
    ('baby-carno', 'Baby Carnotaurus', 'F', 'collage', 50, K, MEAT, '1 m long', 'Horn Poke', 1, 10, 'Dash', 2, 30,
     'Carnotaurus means "meat-eating bull", because of its two horns.',
     'A baby Carnotaurus with two tiny bull horns and very tiny arms, running fast towards the right, seen from the side.'),
    # Smaller dinosaurs, flyers and swimmers.
    ('compy', 'Compsognathus', 'L', 'crayon', 40, J, MEAT, '1 m long', 'Quick Nip', 1, 10, 'Zoom Dash', 2, 30,
     'About the size of a chicken, and one of the fastest little hunters of its time.',
     'A small green Compsognathus chasing a dragonfly between ferns.'),
    ('para', 'Parasaurolophus', 'W', 'crayon', 70, K, PLANT, '9 m long', 'Crest Honk', 1, 20, 'Herd Rush', 2, 40,
     'Its hollow crest worked like a trumpet, so it could call to its herd from far away.',
     'Two Parasaurolophus at the edge of a lake, one drinking and one calling.'),
    ('pachy', 'Pachycephalosaurus', 'R', 'crayon', 60, K, PLANT, '4.5 m long', 'Head Bonk', 1, 20, 'Dome Charge', 3, 50,
     'The bone on top of its head was 25 cm thick. That is thicker than a brick!',
     'A Pachycephalosaurus charging head-on down a rocky hillside.'),
    ('galli', 'Gallimimus', 'T', 'toon', 50, K, ALL, '6 m long', 'Sprint', 1, 10, 'Flock Dash', 2, 30,
     'It looked like a giant ostrich and could run as fast as a racehorse.',
     'An ostrich-like Gallimimus with a long neck sprinting flat out towards the right, legs a blur, looking back over its shoulder in a panic.'),
    ('micro', 'Microraptor', 'S', 'origami', 40, K, MEAT, '80 cm long', 'Glide', 1, 10, 'Four-Wing Dive', 2, 30,
     'It had four wings: feathers on its arms and on its legs.',
     'A small four-winged Microraptor gliding with all four feathered wings spread, seen from above.'),
    ('proto', 'Protoceratops', 'R', 'felt', 50, K, PLANT, '2 m long', 'Beak Peck', 1, 10, 'Nest Guard', 2, 30,
     'About the size of a sheep. Whole nests of its babies have been found.',
     'A small Protoceratops with a neck frill and a beak, standing guard over a nest of round eggs, facing the viewer.'),
    ('psitta', 'Psittacosaurus', 'L', 'shapes', 40, K, PLANT, '2 m long', 'Parrot Peck', 1, 10, 'Bristle Flick', 2, 20,
     'Its name means "parrot lizard", because of its parrot-like beak.',
     'A Psittacosaurus with a parrot beak and a row of bristles on its tail, seen from the side, facing LEFT, nibbling a seed pod.'),
    ('hypsi', 'Hypsilophodon', 'L', 'chalk', 40, K, PLANT, '2 m long', 'Dodge', 1, 10, 'Zigzag Run', 2, 20,
     'Small and speedy, it escaped danger by zigzagging away.',
     'Three small Hypsilophodons running in a zigzag line away into the distance, seen from behind.'),
    ('coelo', 'Coelophysis', 'T', 'lino', 50, TR, MEAT, '3 m long', 'Snap', 1, 10, 'Pack Hunt', 2, 30,
     'One of the earliest dinosaurs, light and quick, with hollow bones.',
     'A slender Coelophysis with a long neck and tail, twisting round in an S shape to snap at a lizard, facing LEFT.'),
    ('ovi', 'Oviraptor', 'T', 'felt', 50, K, ALL, '2 m long', 'Egg Hug', 1, 10, 'Crest Bash', 2, 30,
     'It sat on its nest to keep its eggs warm, just like a bird.',
     'An Oviraptor with a head crest and feathered arms, sitting on a nest with its wings wrapped around the eggs, seen from the front.'),
    ('troodon', 'Troodon', 'T', 'neon', 50, K, MEAT, '2.5 m long', 'Night Eyes', 1, 10, 'Clever Trap', 2, 30,
     'It had big eyes for seeing in the dark, and a large brain for a dinosaur.',
     'A Troodon with enormous round eyes, creeping through the night on tiptoe towards the right, looking sideways at the viewer.'),
    ('dryo', 'Dryosaurus', 'L', 'watercolour', 40, J, PLANT, '3 m long', 'Leaf Nibble', 1, 10, 'Quick Step', 2, 20,
     'Its name means "tree lizard", because it lived in forests.',
     'A Dryosaurus standing on its back legs among tall tree trunks, reaching up to nibble a low branch, seen from behind.'),
    ('leaelly', 'Leaellynasaura', 'L', 'kawaii', 40, K, PLANT, '1 m long', 'Snuggle', 1, 10, 'Snow Hop', 2, 20,
     'It lived near the South Pole and had a very long tail to wrap up in.',
     'A small Leaellynasaura with a very long fluffy tail wrapped around itself like a scarf, sitting in falling snow.'),
    ('maia', 'Maiasaura', 'L', 'clay', 60, K, PLANT, '9 m long', 'Lullaby', 1, 10, 'Herd Shield', 2, 30,
     'Its name means "good mother lizard". It fed its babies in the nest.',
     'A mother Maiasaura bending her head down into a round mud nest full of tiny babies, seen from above.'),
    ('sino', 'Sinosauropteryx', 'T', 'ink', 40, K, MEAT, '1 m long', 'Tail Flick', 1, 10, 'Stripe Dash', 2, 20,
     'The first dinosaur found with feathers. Its tail had ginger and white stripes.',
     'A small fuzzy Sinosauropteryx with a long stripy tail held straight up, trotting towards the LEFT.'),
    ('archaeo', 'Archaeopteryx', 'S', 'glass', 40, J, BUGS, '50 cm long', 'Flap', 1, 10, 'Feather Glide', 2, 20,
     'Part dinosaur, part bird: it had wings and feathers, but teeth and claws too.',
     'An Archaeopteryx with wings spread wide, perched on a branch, seen from the front.'),
    ('dimorph', 'Dimorphodon', 'S', 'cave', 40, J, BUGS, '1.5 m wings', 'Bug Snap', 1, 10, 'Swoop', 2, 20,
     'A flying reptile with a big puffin-like head and two kinds of teeth.',
     'Two Dimorphodons with big heads and long tails flying in a circle around each other.'),
    ('ptero', 'Pterodactylus', 'S', 'origami', 40, J, FISH, '1 m wings', 'Skim', 1, 10, 'Beak Jab', 2, 20,
     'The first flying reptile ever discovered, about the size of a seagull.',
     'A Pterodactylus hanging upside down from a branch like a bat, wings folded, looking at the viewer.'),
    ('ichthyo', 'Ichthyosaurus', 'W', 'pixel', 50, J, FISH, '2 m long', 'Wave Leap', 1, 10, 'Speed Swim', 2, 30,
     'A sea reptile shaped like a dolphin, with huge eyes for seeing in deep water.',
     'A dolphin-shaped Ichthyosaurus leaping right out of the sea in an arc, seen from the side, heading LEFT.'),
    ('mussa', 'Mussaurus', 'L', 'mabel', 30, TR, PLANT, '3 m long', 'Squeak', 1, 10, 'Scurry', 2, 20,
     'Its name means "mouse lizard", because its babies were tiny enough to fit in your hand.',
     'A tiny Mussaurus standing in a giant human hand.'),
    ('minmi', 'Minmi', 'R', 'toon', 50, K, PLANT, '3 m long', 'Hunker', 1, 10, 'Armour Roll', 2, 20,
     'A small armoured dinosaur from Australia, with armour even on its tummy.',
     'A small round armoured Minmi lying flat on the ground hiding, with only its eyes peeking up, seen from the front.'),
    ('hetero', 'Heterodontosaurus', 'L', 'biro', 40, J, ALL, '1 m long', 'Tusk Nip', 1, 10, 'Bristle Rush', 2, 20,
     'It had three kinds of teeth, including little tusks.',
     'A small Heterodontosaurus with two tiny tusks, rearing up and showing its teeth, seen from the front.'),
    ('eo', 'Eoraptor', 'T', 'shapes', 40, TR, ALL, '1 m long', 'First Step', 1, 10, 'Dawn Dash', 2, 20,
     'One of the very first dinosaurs of all. Its name means "dawn thief".',
     'A small Eoraptor running towards the right in front of a huge rising sun.'),
    ('herrera', 'Herrerasaurus', 'F', 'lino', 60, TR, MEAT, '4 m long', 'Lunge', 1, 20, 'Ambush', 2, 40,
     'One of the earliest big hunters, from before the giants appeared.',
     'A Herrerasaurus crouched low among horsetail plants, about to spring, seen from the front.'),
    ('lesotho', 'Lesothosaurus', 'L', 'chalk', 30, J, PLANT, '1 m long', 'Hop', 1, 10, 'Quick Nibble', 2, 20,
     'A tiny, fast plant-eater, no bigger than a cat.',
     'A tiny Lesothosaurus hopping over a log, seen from the side, heading LEFT.'),
    ('struthio', 'Struthiomimus', 'T', 'swirl', 50, K, ALL, '4 m long', 'Long Stride', 1, 10, 'Whirl', 2, 30,
     'Its name means "ostrich mimic". It had no teeth at all.',
     'A long-legged Struthiomimus spinning round on one foot like a dancer.'),
]

UNCOMMON = [
    ('iguano', 'Iguanodon', 'L', 'cave', 90, K, PLANT, '10 m long', 'Thumb Spike', 1, 20, 'Herd March', 3, 60,
     'It had a spike on each thumb. The first scientists thought the spike went on its nose!',
     'A herd of three Iguanodons with thumb spikes, walking in a line towards the right.'),
    ('dilo', 'Dilophosaurus', 'F', 'biro', 90, J, MEAT, '7 m long', 'Crest Flash', 1, 20, 'Hiss Strike', 3, 60,
     'It had two thin crests on its head, like a pair of half plates.',
     'A Dilophosaurus with two crests on its head, rearing up and hissing, seen from below.'),
    ('cory', 'Corythosaurus', 'W', 'collage', 80, K, PLANT, '9 m long', 'Helmet Honk', 1, 20, 'Wade', 2, 40,
     'Its crest looked like a helmet, and helped it make deep booming calls.',
     'A Corythosaurus with a helmet-shaped crest, wading through a lake up to its knees, facing LEFT.'),
    ('edmonto', 'Edmontosaurus', 'L', 'toon', 80, K, PLANT, '12 m long', 'Duck Bill', 1, 20, 'Big Chew', 2, 40,
     'A duck-billed dinosaur with more than a thousand teeth for grinding plants.',
     'An Edmontosaurus with a wide duck bill and a mouth crammed full of leaves, cheeks bulging, facing the viewer.'),
    ('styraco', 'Styracosaurus', 'R', 'glass', 100, K, PLANT, '5.5 m long', 'Spike Crown', 2, 30, 'Nose Horn', 3, 60,
     'Its frill had a crown of long spikes, and its nose horn was as long as your arm.',
     'A Styracosaurus with a crown of long spikes around its frill and one big nose horn, seen from the front.'),
    ('pachyrhino', 'Pachyrhinosaurus', 'R', 'clay', 90, K, PLANT, '6 m long', 'Nose Bump', 1, 20, 'Snow Push', 3, 50,
     'Where other horned dinosaurs had a nose horn, it had a big flat lump of bone.',
     'Two Pachyrhinosaurus with big bumpy noses pushing their heads together, seen from the side.'),
    ('kentro', 'Kentrosaurus', 'R', 'lino', 90, J, PLANT, '4.5 m long', 'Shoulder Spike', 2, 30, 'Spike Spin', 3, 60,
     'A cousin of Stegosaurus with long spikes all the way down its tail.',
     'A Kentrosaurus covered in spikes from its hips to its tail, swinging its tail round, seen from behind.'),
    ('bary', 'Baryonyx', 'W', 'swirl', 100, K, FISH, '9 m long', 'Hook Claw', 2, 30, 'River Grab', 3, 60,
     'It hooked fish out of rivers with a giant claw on each thumb.',
     'A Baryonyx with a long crocodile snout standing in a river, flicking a fish up into the air with one big claw.'),
    ('deino', 'Deinonychus', 'T', 'spray', 100, K, MEAT, '3.5 m long', 'Terrible Claw', 2, 30, 'Leap Attack', 3, 70,
     'Its name means "terrible claw". It was the bigger cousin of Velociraptor.',
     'A feathered Deinonychus in mid-air with both clawed feet stretched out in front, leaping towards the viewer.'),
    ('cerato', 'Ceratosaurus', 'F', 'neon', 100, J, MEAT, '6 m long', 'Nose Horn', 2, 30, 'Jagged Bite', 3, 60,
     'A hunter with a horn on its nose and a row of bony bumps down its back.',
     'A Ceratosaurus with a horn on its nose, in profile facing right, jaws open.'),
    ('plateo', 'Plateosaurus', 'L', 'watercolour', 80, TR, PLANT, '8 m long', 'Reach', 1, 20, 'Tail Sweep', 2, 40,
     'One of the first big plant-eaters. It could stand up on its back legs to reach high.',
     'A Plateosaurus standing tall on its back legs, pulling a branch down with its hands, seen from the side, facing LEFT.'),
    ('apato', 'Apatosaurus', 'L', 'mabel', 100, J, PLANT, '22 m long', 'Stomp', 2, 30, 'Tail Whip', 3, 60,
     'It could crack its tail like a whip, making a sound as loud as a cannon.',
     'A huge Apatosaurus with a very long neck and a very long tail, next to a tiny tree and a tiny house.'),
    ('bronto', 'Brontosaurus', 'L', 'felt', 100, J, PLANT, '22 m long', 'Thunder Step', 2, 30, 'Long Reach', 3, 50,
     'Its name means "thunder lizard", for the sound of its footsteps.',
     'A Brontosaurus walking towards the right across rolling hills, so long that it fills the whole picture.'),
    ('lambeo', 'Lambeosaurus', 'W', 'shapes', 80, K, PLANT, '9 m long', 'Axe Crest', 1, 20, 'Echo Call', 2, 40,
     'Its crest was shaped like an axe stuck in its head.',
     'A Lambeosaurus with an axe-shaped crest, head raised and calling, in profile facing LEFT.'),
    ('ourano', 'Ouranosaurus', 'L', 'cave', 90, K, PLANT, '7 m long', 'Sail Shade', 1, 20, 'Desert March', 3, 50,
     'A plant-eater with a tall sail on its back, which lived in hot, dry places.',
     'An Ouranosaurus with a tall sail along its back, walking towards the LEFT under a big sun.'),
    ('amarga', 'Amargasaurus', 'L', 'origami', 90, K, PLANT, '10 m long', 'Spine Rattle', 2, 30, 'Neck Sweep', 3, 50,
     'It had two rows of tall spines along its neck, like a double mohawk.',
     'An Amargasaurus with two rows of tall spines down its neck, seen from the front with its neck curved to one side.'),
    ('sucho', 'Suchomimus', 'W', 'pixel', 100, K, FISH, '11 m long', 'Croc Snap', 2, 30, 'Swamp Lunge', 3, 60,
     'Its name means "crocodile mimic", because of its long, narrow jaws.',
     'A Suchomimus with a long narrow snout lunging out of a swamp at a leaping fish, heading LEFT.'),
    ('pola', 'Polacanthus', 'R', 'kawaii', 80, K, PLANT, '5 m long', 'Spike Shell', 1, 20, 'Prickle Roll', 2, 40,
     'Its name means "many spines". It was covered in them.',
     'A round little Polacanthus covered in spikes like a hedgehog, looking very pleased with itself.'),
    ('plesio', 'Plesiosaurus', 'W', 'ink', 90, J, FISH, '3.5 m long', 'Flipper Glide', 1, 20, 'Neck Strike', 3, 50,
     'A sea reptile with four flippers and a long neck, which "flew" through the water.',
     'A long-necked Plesiosaurus with four flippers, swimming down in a curve through deep water, seen from the side.'),
    ('elasmo', 'Elasmosaurus', 'W', 'chalk', 100, K, FISH, '14 m long', 'Deep Dive', 2, 30, 'Long Neck Lash', 3, 60,
     'Its neck was longer than the rest of its body, with 72 bones in it.',
     'An Elasmosaurus whose incredibly long neck loops once right round the picture, with small fish swimming through the loop.'),
    ('rhampho', 'Rhamphorhynchus', 'S', 'biro', 80, J, FISH, '1.8 m wings', 'Tail Rudder', 1, 20, 'Dive Bomb', 2, 40,
     'A flying reptile with needle teeth and a diamond-shaped tip on its tail.',
     'A Rhamphorhynchus with a long tail ending in a diamond shape, diving straight down towards the sea, seen from above.'),
    ('alberto', 'Albertosaurus', 'F', 'spray', 110, K, MEAT, '9 m long', 'Chase', 2, 30, 'Pack Bite', 3, 70,
     'A smaller, faster cousin of T. rex that may have hunted in packs.',
     'An Albertosaurus running flat out towards the LEFT, jaws open, seen from the side.'),
    ('euoplo', 'Euoplocephalus', 'R', 'crayon', 90, K, PLANT, '6 m long', 'Shield Up', 1, 20, 'Club Thump', 3, 60,
     'Its name means "well-armoured head". Even its eyelids were armoured.',
     'An armoured Euoplocephalus seen from behind, its heavy tail club raised in the air.'),
    ('argentino', 'Argentinosaurus', 'L', 'storybook', 110, K, PLANT, '35 m long', 'Earth Shake', 2, 30, 'Giant Stride', 4, 70,
     'Maybe the biggest land animal ever: as long as three buses and as heavy as ten elephants.',
     'A colossal Argentinosaurus walking through a forest that only reaches its knees, with birds circling its head, seen from far below.'),
]

RARE = [
    ('rex', 'Tyrannosaurus Rex', 'F', 'biro', 200, K, MEAT, '12 m long', 'King Roar', 3, 90, 'Titan Bite', 4, 160,
     'The king. Its bite was the strongest of any land animal that has ever lived.',
     'A Tyrannosaurus rex seen from the front, stomping straight towards the viewer, roaring, with tiny arms.'),
    ('spino', 'Spinosaurus', 'W', 'clay', 180, K, FISH, '15 m long', 'River Lunge', 2, 70, 'Sail Storm', 4, 140,
     'The longest meat-eating dinosaur ever found, and it could swim.',
     'A Spinosaurus with a tall sail and a long crocodile snout, swimming with just its sail and eyes above the water, heading LEFT.'),
    ('trike', 'Triceratops', 'L', 'pixel', 160, K, PLANT, '9 m long', 'Frill Flash', 2, 60, 'Triple Horn', 3, 120,
     'Its skull was one of the biggest of any land animal: as long as a small car.',
     'A Triceratops charging through a jungle clearing.'),
    ('raptor', 'Velociraptor', 'T', 'ink', 150, K, MEAT, '2 m long', 'Claw Flurry', 2, 60, 'Pack Ambush', 3, 110,
     'It was covered in feathers and was about as tall as a turkey.',
     'A feathered Velociraptor leaping through the air from the right towards the left, claws out.'),
    ('brachio', 'Brachiosaurus', 'L', 'collage', 170, J, PLANT, '26 m long', 'Tree Topper', 2, 60, 'Mighty Stomp', 4, 130,
     'As tall as a four-storey building. Its front legs were longer than its back legs.',
     'A Brachiosaurus with an enormously long neck reaching up to eat leaves from the very top of a tall tree, seen from the side, facing LEFT.'),
    ('anky', 'Ankylosaurus', 'R', 'watercolour', 150, K, PLANT, '8 m long', 'Armour Up', 1, 40, 'Club Smash', 3, 120,
     'Built like a tank. Even its eyelids were covered in armour.',
     'An Ankylosaurus seen from above, swinging its tail club in a canyon.'),
    ('giga', 'Giganotosaurus', 'F', 'shapes', 180, K, MEAT, '13 m long', 'Giant Jaws', 3, 80, 'Southern Fury', 4, 150,
     'Even longer than T. rex, with a skull as long as a grown-up.',
     'A giant Giganotosaurus seen from the front, head lowered towards the viewer, towering over tiny trees.'),
    ('stego', 'Stegosaurus', 'L', 'watercolour', 150, J, PLANT, '9 m long', 'Plate Shield', 1, 40, 'Spike Swing', 3, 110,
     'The four spikes on its tail have their own name: a thagomizer.',
     'A Stegosaurus seen from behind, walking into a meadow, looking back.'),
    ('allo', 'Allosaurus', 'F', 'lino', 160, J, MEAT, '9 m long', 'Hatchet Bite', 2, 70, 'Ambush', 3, 120,
     'The top hunter of the Jurassic. It swung its head like an axe.',
     'An Allosaurus striding to the LEFT with jaws open, seen from the side, with ferns and a low sun behind.'),
    ('carno', 'Carnotaurus', 'F', 'neon', 160, K, MEAT, '8 m long', 'Bull Rush', 2, 70, 'Horn Charge', 3, 120,
     'A hunter with two bull horns, and arms even smaller than a T. rex\'s.',
     'A Carnotaurus with two bull horns above its eyes and tiny arms, seen head-on, charging at the viewer.'),
    ('ptera', 'Pteranodon', 'S', 'pixel', 140, K, FISH, '7 m wings', 'Sky Dive', 2, 50, 'Wind Slice', 3, 100,
     'Not a dinosaur but a flying reptile, with wings wider than a bus is long.',
     'A Pteranodon seen from below, flying over sea cliffs at sunset.'),
    ('mosa', 'Mosasaurus', 'W', 'glass', 170, K, MEAT, '15 m long', 'Deep Lunge', 2, 70, 'Sea King', 4, 140,
     'The giant of the ancient seas, with a second set of teeth in the roof of its mouth.',
     'A huge Mosasaurus rising from the deep with its jaws wide open, seen from above, with small fish scattering.'),
    ('theri', 'Therizinosaurus', 'L', 'swirl', 150, K, PLANT, '10 m long', 'Scythe Swipe', 2, 60, 'Giant Claws', 3, 110,
     'Its claws were a metre long: the longest of any animal ever. It used them to pull down branches.',
     'A pot-bellied feathered Therizinosaurus with three enormously long claws on each hand, arms flung wide, seen from the front.'),
    ('diplo', 'Diplodocus', 'L', 'chalk', 150, J, PLANT, '26 m long', 'Whip Tail', 2, 60, 'Long March', 3, 100,
     'One of the longest dinosaurs. Its tail alone had about 80 bones.',
     'A Diplodocus so long that its neck stretches off towards the top right and its whip tail curls right across the bottom, seen from slightly above.'),
    ('quetzal', 'Quetzalcoatlus', 'S', 'ink', 160, K, MEAT, '11 m wings', 'Shadow Glide', 2, 60, 'Sky Titan', 4, 120,
     'The biggest flying animal ever. Standing up, it was as tall as a giraffe.',
     'A gigantic Quetzalcoatlus with a very long beak, standing on the ground on its folded wings, as tall as the trees, seen from the side.'),
    ('utah', 'Utahraptor', 'T', 'shapes', 160, K, MEAT, '6 m long', 'Giant Claw', 2, 70, 'Raptor Rush', 3, 120,
     'The biggest raptor of all: as heavy as a polar bear, with a claw as long as a banana.',
     'A big feathered Utahraptor with one huge sickle claw raised, in profile facing LEFT.'),
]

# Alternate art: id, the base card it is a new picture of, artist, scene.
ULTRA = [
    ('rex-ultra', 'rex', 'glass', 'A Tyrannosaurus rex head in profile facing LEFT, roaring, jaws wide, with rays of light behind it.'),
    ('spino-ultra', 'spino', 'swirl', 'A Spinosaurus with a tall sail on its back and a long crocodile snout, rising up out of the water with a fish in its jaws, seen from the front.'),
    ('trike-ultra', 'trike', 'lino', 'A Triceratops seen exactly from the front, its huge patterned frill filling the top of the picture like a shield, three horns pointing at the viewer.'),
    ('raptor-ultra', 'raptor', 'spray', 'A feathered Velociraptor crouched on a rock, facing the viewer.'),
    ('brachio-ultra', 'brachio', 'storybook', 'A Brachiosaurus seen from far below, its neck rising up through the clouds, with tiny pterosaurs flying around its head at sunset.'),
    ('anky-ultra', 'anky', 'felt', 'An Ankylosaurus seen from the side facing right, its tail club swung high over its back, every armour plate a different patch.'),
    ('giga-ultra', 'giga', 'neon', 'A Giganotosaurus in profile facing right, mouth wide open in a roar, drawn as a giant glowing sign.'),
    ('stego-ultra', 'stego', 'glass', 'A Stegosaurus seen from the side facing LEFT, each of its tall back plates a different jewel colour, with the sun setting behind them.'),
    ('allo-ultra', 'allo', 'spray', 'An Allosaurus leaping down from a rock ledge towards the viewer, claws spread.'),
    ('carno-ultra', 'carno', 'pixel', 'A Carnotaurus running along a beach at sunset towards the right, kicking up sand.'),
    ('para-ultra', 'para', 'collage', 'A Parasaurolophus with a long curved crest, head thrown back and calling up at a huge full moon, with a herd of small ones along the hill behind.'),
    ('ptera-ultra', 'ptera', 'ink', 'A Pteranodon diving straight down the picture, wings folded back, towards waves at the bottom.'),
    ('mosa-ultra', 'mosa', 'swirl', 'A Mosasaurus twisting in a spiral through the deep sea, surrounded by rings of bubbles and glowing fish.'),
    ('dilo-ultra', 'dilo', 'cave', 'A Dilophosaurus with two crests on its head, standing tall, surrounded by hand prints and a ring of tiny dancing figures.'),
    ('compy-ultra', 'compy', 'kawaii', 'A whole pile of tiny Compsognathus stacked on each other\'s shoulders in a wobbly tower to reach a berry.'),
    ('baby-trike-ultra', 'baby-trike', 'mabel', 'A baby Triceratops with a very big mummy Triceratops, holding hands, with flowers and a rainbow.'),
    ('pachy-ultra', 'pachy', 'toon', 'Two Pachycephalosaurus with domed heads bonking heads together in mid-air, with stars flying out.'),
    ('diplo-ultra', 'diplo', 'watercolour', 'A Diplodocus wading across a misty lake at dawn, its long neck and its reflection making one big curve.'),
]
SECRET = [
    ('rex-secret', 'rex', 'storybook', 'A Tyrannosaurus rex asleep at the top of a hill under a huge starry sky with a comet, with small dinosaurs of many kinds curled up asleep all around it, glowing mushrooms and fireflies.'),
    ('spino-secret', 'spino', 'storybook', 'A Spinosaurus wading through a glowing river at twilight in a prehistoric jungle.'),
    ('trike-secret', 'trike', 'clay', 'A whole Triceratops family, two big ones and three babies, having a picnic of ferns and fruit in a clearing, with a volcano, a waterfall and a rainbow behind, every leaf and pebble modelled by hand.'),
    ('raptor-secret', 'raptor', 'neon', 'A pack of five Velociraptors running through a jungle at night, every plant, vine and dinosaur drawn in glowing lines of different colours, with a full moon above.'),
    ('brachio-secret', 'brachio', 'collage', 'A herd of Brachiosaurus crossing a wide valley at sunrise, the nearest one huge in the foreground with birds riding on its back, layers of hills, a river and a volcano behind.'),
]
GOLD = [('rex-gold', 'rex', 'gold', 'A mighty Tyrannosaurus rex roaring, head and shoulders in three-quarter view, wearing a small crown.')]

# Secret rares carry foil on chosen parts of the picture only. Each entry places soft ovals over those
# parts: (width %, height %, centre x %, centre y %) of the card.
SPOTS = {
    'rex-secret': [(44, 12, 50, 27), (30, 7, 62, 6), (56, 9, 50, 74)],        # the sleeping T. rex, the comet, the lake
    'spino-secret': [(30, 15, 36, 30), (17, 8, 71, 8), (62, 11, 50, 69)],     # its sail, the moon, the water
    'trike-secret': [(42, 8, 52, 8), (16, 12, 82, 22), (46, 11, 52, 56)],      # the rainbow, the waterfall, the babies
    'raptor-secret': [(15, 8, 72, 8), (38, 15, 58, 38), (64, 9, 50, 86)],      # the moon, the lead raptor, the glowing ground
    'brachio-secret': [(32, 10, 26, 10), (30, 18, 30, 44), (34, 9, 70, 63)],   # the sun, the nearest Brachiosaurus, the river
}

# How much stronger the alternate-art versions are than their base card.
BOOST = {'ultra': 60, 'secret': 110, 'gold': 180}

cards = []
by_id = {}


def add(card):
    card['no'] = len(cards) + 1
    card['artistName'] = ARTISTS[card['artist']]
    cards.append(card)
    by_id[card['id']] = card


for rarity, rows in (('common', COMMON), ('uncommon', UNCOMMON), ('rare', RARE)):
    for (cid, name, typ, artist, power, era, diet, size, m1, c1, d1, m2, c2, d2, fact, scene) in rows:
        add({
            'id': cid, 'name': name, 'rarity': rarity, 'type': TYPES[typ], 'artist': artist, 'power': power,
            'era': era, 'diet': diet, 'size': size,
            'moves': [{'name': m1, 'cost': c1, 'dmg': d1}, {'name': m2, 'cost': c2, 'dmg': d2}],
            'fact': fact, 'scene': scene,
        })

for rarity, rows in (('ultra', ULTRA), ('secret', SECRET), ('gold', GOLD)):
    for (cid, base_id, artist, scene) in rows:
        base = by_id[base_id]
        add({
            **{k: base[k] for k in ('name', 'type', 'era', 'diet', 'size', 'fact')},
            'id': cid, 'base': base_id, 'rarity': rarity, 'artist': artist, 'power': base['power'] + BOOST[rarity],
            'moves': [{**m, 'dmg': m['dmg'] + BOOST[rarity] // 2} for m in base['moves']],
            'scene': scene,
        })
        if cid in SPOTS:
            cards[-1]['spots'] = ', '.join(
                f'radial-gradient(ellipse {w}% {h}% at {x}% {y}%, #000 42%, transparent 100%)' for (w, h, x, y) in SPOTS[cid]
            )

counts = {}
for c in cards:
    counts[c['rarity']] = counts.get(c['rarity'], 0) + 1
assert len(cards) == 100, len(cards)
assert len(by_id) == 100, 'duplicate ids'
assert set(SPOTS) == {c['id'] for c in cards if c['rarity'] == 'secret'}, 'every secret rare needs its foil spots'
assert counts == {'common': 36, 'uncommon': 24, 'rare': 16, 'ultra': 18, 'secret': 5, 'gold': 1}, counts

out = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'set.json'
out.write_text(json.dumps(cards, indent=1, ensure_ascii=False) + '\n')
used = {}
for c in cards:
    used[c['artist']] = used.get(c['artist'], 0) + 1
print('cards per artist:', dict(sorted(used.items(), key=lambda kv: -kv[1])))
print(f'wrote {out} with {len(cards)} cards: {counts}')
