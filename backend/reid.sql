create temp table idmap (
    newid integer primary key,
    oldid integer not null unique
);

insert into idmap(oldid)
    select id from obj order by id asc;

-- newid starts with 1, but lobby OID is 0
update idmap set newid = newid - 1;


create temp table reobj(
    id integer primary key,
    val text not null
);


with recursive
    re(id, val) as (
        
    )

with recursive
    apart as (
        
    )
    select 0 from obj;
