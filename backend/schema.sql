create table obj(
   id integer primary key,
   val text not null
);


-- This is just to expose the 'bootstrap.js' members in a convenient form.  These entries
-- are needed to bootstrap the image loading procedure.
create view bootstrap_entries as
    select 
        def_json.key as entry,
        json_extract(def_row.val, '$.src') as src
    from json_each((
       select val
       from obj
       where id = (
          select json_extract(val, '$.bootstrapDefs.__ref')
          from obj
          where id = 0
       )
    )) as def_json
        join obj as def_row on json_extract(def_json.value, '$.__ref') = def_row.id
;

-- Lobby object is always there
insert into obj(id, val) values (0, '{}');
