import {cpSync,mkdirSync} from 'node:fs';
mkdirSync('public/flags',{recursive:true});
cpSync('node_modules/flag-icons/flags/4x3','public/flags',{recursive:true});
cpSync('node_modules/flag-icons/LICENSE','public/flags/LICENSE.txt');
