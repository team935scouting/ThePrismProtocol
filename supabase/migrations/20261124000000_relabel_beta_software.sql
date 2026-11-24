-- The team portal manages beta software, which is separate from the TPP library.
update public.software
set slug = 'prism-beta',
    name = 'Prism beta software',
    description = 'Beta software managed by the portal; separate from the TPP library.'
where slug = 'prism-os';
