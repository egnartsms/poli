create table module(
    id integer primary key,
    name text not null
);

create table entry(
    ord integer primary key,
    module_id integer not null references module(id),
    key not null,
    def json not null,
    unique (module_id, key)
);
