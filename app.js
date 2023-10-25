const express = require('express');
const sqlite3 = require('sqlite3');
const ejs = require('ejs');
require("dotenv").config();
const { updateServer } = require("./updateServer");
const { restartServer } = require("./restartServer");
const multer = require("multer");
const app = express();
const port = process.env.PORT || 3000;
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Serve static files from the "views" directory
app.use(express.static('views'));

// Conectar a la base de datos SQLite
const db = new sqlite3.Database(process.env.DATABASE != null ? __dirname + process.env.DATABASE : 'C:\\Users\\Pablo\\OneDrive - Universidad Austral\\Bases de Datos y Recursos de Información\\Unidad 5 El lenguaje de consulta SQL\\datagrip\\movies.db');

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Configurar parser de JSON
app.use(express.json());

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para buscar películas
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;

    if (searchTerm == 'xoaco') {
        res.sendFile(__dirname + "/xoaco.png");
        return;
    }
    // Realizar la búsqueda en la base de datos
    db.all(
        `SELECT * 
        FROM movie AS m 
        WHERE m.title LIKE ?;`,
        [`%${searchTerm}%`],
        (err, rows) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            } else {
                db.all(
                    `SELECT DISTINCT person.person_name, person.person_id 
                    FROM movie_crew
                    INNER JOIN person ON person.person_id = movie_crew.person_id
                    WHERE movie_crew.job = 'Director' AND person.person_name LIKE ?;`,
                    [`%${searchTerm}%`],
                    (err2, row2) => {
                        if (err2) {
                            console.error(err2);
                            res.status(500).send('Error en la búsqueda.');
                        }
                        else {
                            db.all(
                                `SELECT DISTINCT person.person_name, person.person_id 
                                FROM movie_cast
                                INNER JOIN person ON person.person_id = movie_cast.person_id
                                WHERE person.person_name LIKE ?;`,
                                [`%${searchTerm}%`],
                                (err3, row3) => {
                                    if (err3) {
                                        console.error(err3);
                                        res.status(500).send('Error en la búsqueda.');
                                    }
                                    else {
                                        res.render('resultado', {
                                            movies: rows,
                                            directors: row2,
                                            actors: row3
                                        });
                                    }
                                }
                            )
                        }
                    }
                )
            }
        }
    );
});

// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;

    // Consulta SQL para obtener los datos de la película, elenco y crew
    const query = `
    SELECT
      movie.*,
      actor.person_name as actor_name,
      actor.person_id as actor_id,
      crew_member.person_name as crew_member_name,
      crew_member.person_id as crew_member_id,
      movie_cast.character_name,
      movie_cast.cast_order,
      department.department_name,
      movie_crew.job,   
      genre.*,
      country.*,
      language.language_name
    FROM movie
    LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
    LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id 
    LEFT JOIN movie_genres ON movie_genres.movie_id = movie.movie_id
    LEFT JOIN genre ON genre.genre_id = movie_genres.genre_id
    LEFT JOIN production_country ON production_country.movie_id = movie.movie_id
    LEFT JOIN country ON country.country_id = production_country.country_id
    LEFT JOIN movie_languages ON movie_languages.movie_id = movie.movie_id
    LEFT JOIN language ON language.language_id = movie_languages.language_id
    WHERE movie.movie_id = ?
  `;

/*lo dejo aca por las moscas
    LEFT JOIN movie_company ON movie_company.movie_id = movie.movie_id
    LEFT JOIN production_company ON production_company.company_id = movie_company.company_id
    LEFT JOIN language_role ON language_role.role_id = movie_languages.language_role_id
        language_role.language_role,
        production_company.company_name
*/

    // Ejecutar la consulta
    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar los datos de la película.');
        } else if (rows.length === 0) {
            res.status(404).send('Película no encontrada.');
        } else {
            // Organizar los datos en un objeto de película con elenco y crew
            const movieData = {
                id: rows[0].id,
                title: rows[0].title,
                release_date: rows[0].release_date,
                overview: rows[0].overview,
                directors: [],
                writers: [],
                cast: [],
                crew: [],
                genre: [],
                country: rows[0].country_name,
                language: rows[0].language_name,
                //language_roles: [],
                //companies: []
            };

            rows.forEach((row) =>{
                if(row.genre_id && row.genre_name){
                    const isDuplicate = movieData.genre.some((gen) =>
                    gen.genre_id === row.genre_id
                    );
                    if (!isDuplicate) {
                            movieData.genre.push({
                                genre_name: row.genre_name,
                                genre_id: row.genre_id
                            });
                    }
                }
            })
/*
            rows.forEach((row) =>{
                if(row.language_role){
                    const isDuplicate = movieData.genre.some((role) =>
                    role.language_role === row.language_role
                    );
                    if (!isDuplicate) {
                            movieData.language_roles.push({
                                role: row.language_role
                            });
                    }
                }
            })

            rows.forEach((row) =>{
                if(row.company_name){
                    const isDuplicate = movieData.companies.some((comp) =>
                    comp.company_name === row.company_name
                    );
                    if (!isDuplicate) {
                            movieData.companies.push({
                                company: row.company_name
                            });
                    }
                }
            })
*/

            // Crear un objeto para almacenar directores
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en directors
                    const isDuplicate = movieData.directors.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de directors
                        if (row.department_name === 'Directing' && row.job === 'Director') {
                            movieData.directors.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar writers
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en writers
                    const isDuplicate = movieData.writers.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de writers
                        if (row.department_name === 'Writing' && row.job === 'Writer') {
                            movieData.writers.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar el elenco
            rows.forEach((row) => {
                if (row.actor_id && row.actor_name && row.character_name) {
                    // Verificar si ya existe una entrada con los mismos valores en el elenco
                    const isDuplicate = movieData.cast.some((actor) =>
                        actor.actor_id === row.actor_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de elenco
                        movieData.cast.push({
                            actor_id: row.actor_id,
                            actor_name: row.actor_name,
                            character_name: row.character_name,
                            cast_order: row.cast_order,
                        });
                    }
                }
            });

            // Crear un objeto para almacenar el crew
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en el crew
                    const isDuplicate = movieData.crew.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    // console.log('movieData.crew: ', movieData.crew)
                    // console.log(isDuplicate, ' - row.crew_member_id: ', row.crew_member_id)
                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de crew
                        if (row.department_name !== 'Directing' && row.job !== 'Director'
                            && row.department_name !== 'Writing' && row.job !== 'Writer') {
                            movieData.crew.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            res.render('pelicula', {movie: movieData});
        }
    });
});

// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;

    // Consulta SQL para obtener las películas en las que participó el actor
    const query = `
    SELECT DISTINCT
      person.person_name as actorName,
      movie_cast.character_name as role,
      movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?
    UNION
    SELECT DISTINCT
    person.person_name as actorName,
    movie_crew.job as role,
    movie.*
    FROM movie
    INNER JOIN movie_crew ON movie_crew.movie_id = movie.movie_id
    INNER JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job LIKE 'Director' AND movie_crew.person_id = ?;
  `;

    // Ejecutar la consulta
    db.all(query, [actorId, actorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        } else {
            // Obtener el nombre del actor
            const actorName = movies.length > 0 ? movies[0].actorName : '';
            const actedMovies = [];
            const directedMovies = [];
            // separo de la consulta las peliculas donde dirigió y donde actuó
            movies.forEach((row) =>{
                if (row.role !== 'Director'){
                    actedMovies.push({
                        release_date: row.release_date,
                        movie_id: row.movie_id,
                        title: row.title,
                        role: row.role
                    })
                }
                else {
                    directedMovies.push({
                        release_date: row.release_date,
                        movie_id: row.movie_id,
                        title: row.title,
                        role: row.role
                    })
                }
            })
            res.render('actor', { actorName, directedMovies, actedMovies });
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get('/director/:id', (req, res) => {
    const directorId = req.params.id;

    // Consulta SQL para obtener las películas dirigidas por el director
    const query = `
    SELECT DISTINCT
        person.person_name as directorName,
        movie_crew.job as role,
        movie.*
    FROM movie
    INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    INNER JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?
    UNION
    SELECT DISTINCT
        person.person_name as directorName,
        movie_cast.character_name as role   ,
        movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON movie_cast.person_id = person.person_id
    WHERE movie_cast.person_id = ?;
  `;


    // console.log('query = ', query)

    // Ejecutar la consulta
    db.all(query, [directorId, directorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        } else {
            // console.log('movies.length = ', movies.length)
            // Obtener el nombre del director
            const directorName = movies.length > 0 ? movies[0].directorName : '';
            const actedMovies = [];
            const directedMovies = [];
            movies.forEach((row) =>{
            // separo de la consulta las peliculas donde dirigió y donde actuó
                if (row.role !== 'Director'){
                    actedMovies.push({
                        title: row.title,
                        release_date: row.release_date,
                        movie_id: row.movie_id,
                        rol: row.role,
                    })
                }
                else {
                    directedMovies.push({
                        title: row.title,
                        release_date: row.release_date,
                        movie_id: row.movie_id,
                        rol: row.role,
                    })
                }
            })
            res.render('director', { directorName, directedMovies, actedMovies });
        }
    });
});

// Ruta para buscar por palabras clave
app.get("/keyword", (req, res) => {
    res.render(__dirname + "/views/search_keyword.ejs");
});

// Funcion para autocompletar la búsqueda
app.get("/api/autocomplete", (req, res) => {
    const { q } = req.query;
    if (q == undefined) {
        res.status(400).send("Bad Request");
        return;
    }
    const query = `SELECT k.keyword_name FROM keyword AS k
    WHERE k.keyword_name LIKE ? ORDER BY k.keyword_name LIMIT 10;`;
    db.all(query, [`%${q}%`], (err, rows) => {
        if (err) {
            console.log(err);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.status(200).send(rows);
    });
});

// Ruta para visualizar los resultados de la búsqueda por palabras clave
app.get("/keyword/:q", (req, res) => {
    res.status(200).render(__dirname + "/views/resultados_keywords.ejs");
});

// Funcion para buscar por palabras clave
app.get("/api/keyword", (req, res) => {
    const { q } = req.query;
    if (q == undefined) {
        res.status(400).send("Bad Request");
        return;
    }
    const query = `SELECT * FROM movie AS m WHERE m.movie_id
    IN (SELECT m.movie_id FROM movie AS m
    INNER JOIN movie_keywords AS mk ON m.movie_id
    = mk.movie_id INNER JOIN keyword AS k
    ON mk.keyword_id = k.keyword_id WHERE k.keyword_name
    LIKE ?);`;
    db.all(query, [`%${q}%`], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.status(200).send(rows);
    });
});

app.get("/update", (req, res) => {
    res.sendFile(__dirname + "/views/update.html");
});

app.post("/api/update", upload.single("zipFile"), async (req, res) => {
    const zipFile = req.file;
    if (!zipFile) {
        res.status(400).send("Bad Request");
        return;
    }
    try {
        updateServer(zipFile);
        await restartServer();
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
