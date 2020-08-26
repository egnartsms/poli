create table obj(
   id integer primary key,
   val text not null
);

-- Lobby object is always there
insert into obj(id, val) values (0, '{}');
