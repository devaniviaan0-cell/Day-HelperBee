create table users(id integer primary key autoincrement,name text unique,salt text,hash text,av text,track text,honey integer default 0);
create table sessions(token text primary key,uid integer);
create table friends(a integer,b integer,st text,primary key(a,b));
create table msgs(id integer primary key autoincrement,frm integer,tto integer,body text,ts integer);
create index lb on users(honey desc);
