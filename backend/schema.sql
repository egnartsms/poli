create table obj(
   id integer primary key,
   val text not null
);


-- Lobby object is always there
insert into obj(id, val) values (0, '{}');


-- This is just to expose the 'bootstrap.js' members in a convenient form.  These entries
-- are needed to bootstrap the image loading procedure.
create view bootstrap_entries as
    select 
        def_json.key as entry,
        def_json.value as src
    from json_each((
       select val
       from obj
       where id = (
          select json_extract(val, '$.bootstrapDefs.__ref')
          from obj
          where id = 0
       )
    )) as def_json
;

create view live_obj(id) as
    with recursive
        live(id) AS (
            values (0)
            union
            select json_tree.atom
            from live join obj on obj.id = live.id,
              json_tree(obj.val)
            where json_tree.key = '__ref'
        )
    select id from live
;
