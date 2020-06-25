create table module(
    id integer primary key,
    name text not null
);


create table entry(
    id integer primary key,
    module_id integer not null references module(id),
    name not null,
    def json not null,
    prev_id integer references entry(id),
    unique (module_id, name)
);


create table import(
    recp_module_id integer not null references module(id),
    alias text,
    donor_entry_id integer references entry(id)
);